"""Citation validator: fabricated or absent citations reject the verdict."""
from davacheck.schemas import AuditEvent, AuditResult, Citation, Verdict


def build_citations(material_claims, evidence: list[dict]) -> tuple[list[Citation], list[AuditEvent]]:
    """Collect citations for final output. Every cited chunk must exist in the
    retrieved evidence set — the ground truth of what was actually retrieved."""
    events: list[AuditEvent] = []
    by_id = {c["chunk_id"]: c for c in evidence}
    citations: dict[str, Citation] = {}
    for claim in material_claims:
        for ref in claim.citation_refs:
            if ref in citations:
                continue
            chunk = by_id.get(ref)
            if chunk is None:
                events.append(
                    AuditEvent(
                        stage="citation_validation",
                        detail=f"fabricated citation blocked: {ref}",
                    )
                )
                continue
            citations[ref] = Citation(
                chunk_id=chunk["chunk_id"],
                doc_id=chunk["doc_id"],
                section=chunk["section"],
                quote=chunk["text"],
            )
    return list(citations.values()), events


def finalize_audit(
    verdict: Verdict,
    explanation: str,
    material_claims,
    evidence: list[dict],
    missing_facts: list[str] | None = None,
    extra_events: list[AuditEvent] | None = None,
) -> AuditResult:
    citations, events = build_citations(material_claims, evidence)
    # hard guarantee: a SUPPORTED verdict without citations cannot exist
    if verdict == Verdict.SUPPORTED and not citations:
        verdict = Verdict.INSUFFICIENT_EVIDENCE
        explanation = "(Blocked: SUPPORTED verdict with zero valid citations.) " + explanation
        events.append(AuditEvent(stage="citation_validation", detail="SUPPORTED with no citations blocked"))
    return AuditResult(
        verdict=verdict,
        explanation=explanation,
        citations=citations,
        material_claims=material_claims,
        missing_facts=missing_facts or [],
        confidence_flag="verified" if not events else "warnings_present",
    ), events
