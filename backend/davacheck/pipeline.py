"""End-to-end audit pipeline: rejection-notice audit + claim-application assessment.

Routes by doc_type — mirrors graph.py for the eval harness (no LangGraph overhead).
"""
import logging

from davacheck.agents.claim_assessment import assess_claim
from davacheck.agents.reasoning import draft_verdict
from davacheck.agents.verification import verify_draft
from davacheck.citations import finalize_audit
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

logger = logging.getLogger("davacheck.pipeline")


def _build_query(facts: CaseFacts) -> str:
    """Shared query builder — prioritises cause_of_loss for claim apps."""
    parts = [
        facts.cause_of_loss,
        facts.category.value.replace("_", " ") if facts.category else None,
        facts.crop,
        facts.season,
        facts.district,
        facts.state,
    ]
    return " ".join(x for x in parts if x)


def run_audit(facts: CaseFacts, notice_text: str) -> tuple[AuditResult, list[AuditEvent]]:
    """Run the full pipeline. Branches on doc_type (mirrors graph.py)."""
    events: list[AuditEvent] = []

    if facts.doc_type == DocType.CLAIM_APPLICATION:
        return _run_claim_audit(facts, notice_text, events)

    # Rejection-notice path (original behaviour, with improved query)
    query = _build_query(facts)
    evidence = get_index().search(query, top_k=8)
    events.append(AuditEvent(stage="retrieval", detail=f"query='{query}', chunks={len(evidence)}"))

    draft = draft_verdict(facts, facts.rejection_reason or notice_text[:500], evidence)
    events.append(AuditEvent(stage="reasoning", detail=f"draft verdict: {draft.verdict.value}", verdict=draft.verdict))

    draft, verify_events = verify_draft(draft, evidence)
    events.extend(verify_events)

    result, citation_events = finalize_audit(
        verdict=draft.verdict,
        explanation=draft.explanation,
        material_claims=draft.material_claims,
        evidence=evidence,
        missing_facts=facts.missing_fields,
        extra_events=events,
    )
    result.material_claims = draft.material_claims
    return result, events + citation_events


def _run_claim_audit(
    facts: CaseFacts, notice_text: str, events: list[AuditEvent]
) -> tuple[AuditResult, list[AuditEvent]]:
    """Assess a claim application against PMFBY policy text."""
    query = _build_query(facts)
    evidence = get_index().search(query, top_k=8)
    events.append(
        AuditEvent(
            stage="claim_retrieval",
            detail=f"query='{query}', chunks={len(evidence)}, peril='{facts.cause_of_loss}', crop='{facts.crop}'",
        )
    )

    assessment = assess_claim(facts, notice_text, evidence)
    events.append(
        AuditEvent(
            stage="claim_assessment",
            detail=(
                f"peril={assessment.peril_coverage.status}, "
                f"crop={assessment.crop_coverage.status}, "
                f"threshold={assessment.loss_threshold.status}"
            ),
        )
    )

    # Build material claims from each assessment dimension
    material_claims: list[MaterialClaim] = []
    for dim_key in ["peril_coverage", "crop_coverage", "loss_threshold", "season_eligibility", "area_triggers"]:
        dim = getattr(assessment, dim_key)
        material_claims.append(
            MaterialClaim(
                claim=dim.assessment,
                citation_refs=dim.policy_refs,
                reasoning=f"Dimension: {dim_key} — {dim.status}",
            )
        )

    # Determine verdict
    statuses = [getattr(assessment, k).status for k in ["peril_coverage", "crop_coverage", "loss_threshold", "season_eligibility", "area_triggers"]]
    if any(s in ("MISSING_EVIDENCE", "UNCLEAR_COVERAGE") for s in statuses):
        verdict = Verdict.INSUFFICIENT_EVIDENCE
    elif any(s == "UNLIKELY_COVERED" for s in statuses):
        verdict = Verdict.NOT_SUPPORTED
    else:
        verdict = Verdict.SUPPORTED

    # Build citations
    citations: list[Citation] = [
        Citation(chunk_id=c["chunk_id"], doc_id=c["doc_id"], section=c["section"], quote=c["text"])
        for c in evidence
    ]

    result = AuditResult(
        verdict=verdict,
        explanation=assessment.summary,
        citations=citations,
        material_claims=material_claims,
        missing_facts=facts.missing_fields + assessment.missing_evidence,
        confidence_flag="warnings_present" if assessment.missing_evidence else "normal",
    )
    events.append(AuditEvent(stage="claim_finalize", detail=f"verdict={verdict.value}, missing_evidence={len(assessment.missing_evidence)}", verdict=verdict))
    return result, events
