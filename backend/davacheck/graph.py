"""LangGraph orchestration: explicit state machine for the audit flow.

States: intake -> retrieval -> reasoning -> verification -> localization ->
grievance (conditional) -> review. Explicit routing, not prompt-buried control
flow (claude.md section 2)."""
import logging
from typing import Annotated, TypedDict

from davacheck.agents.extraction import extract_facts
from davacheck.agents.grievance import draft_grievance
from davacheck.agents.localization import localize
from davacheck.agents.reasoning import draft_verdict
from davacheck.agents.verification import verify_draft
from davacheck.citations import finalize_audit
from davacheck.retrieval import get_index
from davacheck.schemas import AuditEvent, AuditResult, CaseFacts, Verdict

logger = logging.getLogger("davacheck.graph")


class GraphState(TypedDict, total=False):
    notice_text: str
    language: str
    facts: CaseFacts
    evidence: list
    draft: dict
    result: AuditResult
    events: list
    grievance_draft: dict | None


def intake_node(state: GraphState) -> GraphState:
    facts = extract_facts(state["notice_text"])
    return {"facts": facts, "events": [AuditEvent(stage="intake", detail=f"facts extracted, missing={facts.missing_fields}")]}


def retrieval_node(state: GraphState) -> GraphState:
    facts = state["facts"]
    query = " ".join(x for x in [facts.rejection_reason, facts.category.value.replace("_", " "), facts.crop] if x)
    evidence = get_index().search(query, top_k=8)
    return {"evidence": evidence, "events": [AuditEvent(stage="retrieval", detail=f"{len(evidence)} chunks")]}


def reasoning_node(state: GraphState) -> GraphState:
    draft = draft_verdict(state["facts"], state["facts"].rejection_reason or state["notice_text"][:500], state["evidence"])
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


def build_graph():
    from langgraph.graph import END, StateGraph

    graph = StateGraph(GraphState)
    graph.add_node("intake", intake_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("reasoning", reasoning_node)
    graph.add_node("verification", verification_node)
    graph.add_node("localization", localization_node)
    graph.add_node("grievance", grievance_node)

    graph.set_entry_point("intake")
    graph.add_edge("intake", "retrieval")
    graph.add_edge("retrieval", "reasoning")
    graph.add_edge("reasoning", "verification")
    graph.add_edge("verification", "localization")
    graph.add_edge("localization", "grievance")
    graph.add_edge("grievance", END)
    return graph.compile()
