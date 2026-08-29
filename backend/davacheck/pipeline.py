"""End-to-end audit pipeline: retrieval -> reasoning -> verification -> citation validation."""
import logging

from davacheck.agents.reasoning import draft_verdict
from davacheck.agents.verification import verify_draft
from davacheck.citations import finalize_audit
from davacheck.retrieval import get_index
from davacheck.schemas import AuditEvent, AuditResult, CaseFacts

logger = logging.getLogger("davacheck.pipeline")


def run_audit(facts: CaseFacts, notice_text: str) -> tuple[AuditResult, list[AuditEvent]]:
    events: list[AuditEvent] = []
    query = " ".join(
        x
        for x in [facts.rejection_reason, facts.category.value.replace("_", " "), facts.crop]
        if x
    )
    evidence = get_index().search(query, top_k=8)
    events.append(AuditEvent(stage="retrieval", detail=f"{len(evidence)} chunks retrieved"))

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
