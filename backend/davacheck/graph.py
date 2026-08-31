"""LangGraph orchestration: explicit state machine for the audit flow.

Routes by doc_type:
- rejection_notice → intake → retrieval → reasoning → verification → localization → grievance
- claim_application → intake → claim_retrieval → claim_assessment → finalize

Explicit routing, not prompt-buried control flow (claude.md section 2)."""
import logging
from typing import Annotated, TypedDict

from davacheck.agents.claim_assessment import assess_claim
from davacheck.agents.extraction import extract_facts
from davacheck.agents.grievance import draft_grievance
from davacheck.agents.localization import localize
from davacheck.agents.reasoning import draft_verdict
from davacheck.agents.verification import verify_draft
from davacheck.citations import build_citations, finalize_audit
from davacheck.retrieval import get_index
from davacheck.schemas import (
    AuditEvent,
    AuditResult,
    CaseFacts,
    Citation,
    DocType,
    MaterialClaim,
    Verdict,
)

logger = logging.getLogger("davacheck.graph")


class GraphState(TypedDict, total=False):
    notice_text: str
    language: str
    facts: CaseFacts
    evidence: list
    draft: dict
    assessment: dict | None
    result: AuditResult
    events: list
    grievance_draft: dict | None


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _build_retrieval_query(facts: CaseFacts) -> str:
    """Build a BM25 query from available case facts.

    Uses cause_of_loss (peril), district, crop, season, state as signal.
    Avoids rejection_reason — that field is None for claim applications and
    poisons the query with a literal "(not stated)" placeholder.
    """
    parts = [
        facts.cause_of_loss,
        facts.category.value.replace("_", " ") if facts.category else None,
        facts.crop,
        facts.season,
        facts.district,
        facts.state,
    ]
    return " ".join(x for x in parts if x)


# ─── Rejection-notice flow ───────────────────────────────────────────────────

def intake_node(state: GraphState) -> GraphState:
    facts = extract_facts(state["notice_text"])
    return {
        "facts": facts,
        "events": [AuditEvent(stage="intake", detail=f"doc_type={facts.doc_type.value}, missing={facts.missing_fields}")],
    }


def retrieval_node(state: GraphState) -> GraphState:
    facts = state["facts"]
    query = _build_retrieval_query(facts)
    evidence = get_index().search(query, top_k=8)
    return {"evidence": evidence, "events": [AuditEvent(stage="retrieval", detail=f"query='{query}', chunks={len(evidence)}")]}


def reasoning_node(state: GraphState) -> GraphState:
    draft = draft_verdict(
        state["facts"],
        state["facts"].rejection_reason or state["notice_text"][:500],
        state["evidence"],
    )
    return {"draft": draft, "events": [AuditEvent(stage="reasoning", detail=f"draft: {draft.verdict.value}", verdict=draft.verdict)]}


def verification_node(state: GraphState) -> GraphState:
    draft, events = verify_draft(state["draft"], state["evidence"])
    return {"draft": draft, "events": events}


def localization_node(state: GraphState) -> GraphState:
    draft: AuditResult = state["draft"]
    lang = state.get("language", "en")
    if lang != "en":
        draft.explanation = localize(draft.explanation, lang)
    return {"draft": draft}


def grievance_node(state: GraphState) -> GraphState:
    result, _ = finalize_audit(
        verdict=state["draft"].verdict,
        explanation=state["draft"].explanation,
        material_claims=state["draft"].material_claims,
        evidence=state["evidence"],
        missing_facts=state["facts"].missing_fields,
    )
    grievance = None
    if result.verdict != Verdict.SUPPORTED:
        grievance = draft_grievance(result, state["facts"], language=state.get("language", "en"))
    return {"result": result, "grievance_draft": grievance.model_dump() if grievance else None}


# ─── Claim-application flow ──────────────────────────────────────────────────

def claim_retrieval_node(state: GraphState) -> GraphState:
    """Retrieve policy excerpts for a claim application using peril-aware query."""
    facts = state["facts"]
    # Prioritise the cause of loss (peril) as the primary search term
    query = _build_retrieval_query(facts)
    evidence = get_index().search(query, top_k=8)
    return {
        "evidence": evidence,
        "events": [
            AuditEvent(
                stage="claim_retrieval",
                detail=f"query='{query}', chunks={len(evidence)}, peril='{facts.cause_of_loss}', crop='{facts.crop}'",
            )
        ],
    }


def claim_assessment_node(state: GraphState) -> GraphState:
    """Assess a claim application's eligibility against retrieved PMFBY policy."""
    assessment = assess_claim(state["facts"], state["notice_text"], state["evidence"])
    return {
        "assessment": assessment.model_dump(),
        "events": [
            AuditEvent(
                stage="claim_assessment",
                detail=(
                    f"peril={assessment.peril_coverage.status}, "
                    f"crop={assessment.crop_coverage.status}, "
                    f"threshold={assessment.loss_threshold.status}"
                ),
            )
        ],
    }


def claim_finalize_node(state: GraphState) -> GraphState:
    """Convert a claim-assessment result into a DavaCheck AuditResult for the frontend."""
    assessment = state["assessment"]
    evidence = state["evidence"]
    facts = state["facts"]

    # Build material claims from each dimension
    material_claims: list[MaterialClaim] = []
    for dim_key in ["peril_coverage", "crop_coverage", "loss_threshold", "season_eligibility", "area_triggers"]:
        dim = assessment[dim_key]
        material_claims.append(
            MaterialClaim(
                claim=dim["assessment"],
                citation_refs=dim["policy_refs"],
                reasoning=f"Dimension: {dim_key} — {dim['status']}",
            )
        )

    # Determine verdict:
    # UNCLEAR_COVERAGE or MISSING_EVIDENCE in ANY dimension → INSUFFICIENT_EVIDENCE
    # Any dimension UNLIKELY_COVERED → NOT_SUPPORTED
    # All COVERED → SUPPORTED
    statuses = [assessment[k]["status"] for k in ["peril_coverage", "crop_coverage", "loss_threshold", "season_eligibility", "area_triggers"]]
    if any(s in ("MISSING_EVIDENCE", "UNCLEAR_COVERAGE") for s in statuses):
        verdict = Verdict.INSUFFICIENT_EVIDENCE
    elif any(s == "UNLIKELY_COVERED" for s in statuses):
        verdict = Verdict.NOT_SUPPORTED
    else:
        verdict = Verdict.SUPPORTED

    # Build citations from evidence chunks
    citations: list[Citation] = []
    for chunk in evidence:
        citations.append(
            Citation(
                chunk_id=chunk["chunk_id"],
                doc_id=chunk["doc_id"],
                section=chunk["section"],
                quote=chunk["text"],
            )
        )

    result = AuditResult(
        verdict=verdict,
        explanation=assessment["summary"],
        citations=citations,
        material_claims=material_claims,
        missing_facts=facts.missing_fields + assessment["missing_evidence"],
        confidence_flag="warnings_present" if assessment["missing_evidence"] else "normal",
    )
    return {
        "result": result,
        "events": [
            AuditEvent(
                stage="claim_finalize",
                detail=f"verdict={verdict.value}, missing_evidence={len(assessment['missing_evidence'])}",
                verdict=verdict,
            )
        ],
    }


# ─── Routing ─────────────────────────────────────────────────────────────────

def route_node(state: GraphState) -> str:
    doc_type = state["facts"].doc_type
    if doc_type == DocType.CLAIM_APPLICATION:
        return "claim_retrieval"
    return "retrieval"


# ─── Graph builder ───────────────────────────────────────────────────────────

def build_graph():
    from langgraph.graph import END, StateGraph

    graph = StateGraph(GraphState)
    graph.add_node("intake", intake_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("reasoning", reasoning_node)
    graph.add_node("verification", verification_node)
    graph.add_node("localization", localization_node)
    graph.add_node("grievance", grievance_node)
    graph.add_node("claim_retrieval", claim_retrieval_node)
    graph.add_node("claim_assessment", claim_assessment_node)
    graph.add_node("claim_finalize", claim_finalize_node)

    graph.set_entry_point("intake")
    graph.add_conditional_edges(
        "intake",
        route_node,
        {
            "retrieval": "retrieval",
            "claim_retrieval": "claim_retrieval",
        },
    )

    # Rejection-notice path
    graph.add_edge("retrieval", "reasoning")
    graph.add_edge("reasoning", "verification")
    graph.add_edge("verification", "localization")
    graph.add_edge("localization", "grievance")
    graph.add_edge("grievance", END)

    # Claim-application path
    graph.add_edge("claim_retrieval", "claim_assessment")
    graph.add_edge("claim_assessment", "claim_finalize")
    graph.add_edge("claim_finalize", END)

    return graph.compile()
