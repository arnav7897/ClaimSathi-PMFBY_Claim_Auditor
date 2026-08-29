"""Reasoning agent: compares stated rejection reason vs retrieved policy text.

Produces a DRAFT verdict + material claims. A hard guard at code level forces
INSUFFICIENT_EVIDENCE when any material claim lacks valid citation refs —
verification (Phase 4) then checks each claim against the actual evidence.
"""
from pathlib import Path

from davacheck.llm import get_llm
from davacheck.schemas import CaseFacts, DraftVerdict, Verdict

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "reasoning_v1.md"


def build_reasoning_prompt(facts: CaseFacts, rejection_reason: str, evidence: list[dict]) -> str:
    template = PROMPT_PATH.read_text(encoding="utf-8")
    evidence_block = "\n\n".join(
        f"[{c['chunk_id']}] ({c['section']}) {c['text']}" for c in evidence
    )
    return (
        template.replace("{{FACTS}}", facts.model_dump_json(indent=2))
        .replace("{{REJECTION_REASON}}", rejection_reason or "(not stated)")
        .replace("{{EVIDENCE}}", evidence_block or "(no excerpts retrieved)")
    )


def enforce_citation_guard(draft: DraftVerdict, evidence: list[dict]) -> DraftVerdict:
    """Any material claim without at least one valid citation ref forces
    INSUFFICIENT_EVIDENCE. Code-level, not prompt-level (claude.md section 1)."""
    valid_ids = {c["chunk_id"] for c in evidence}
    for claim in draft.material_claims:
        claim.citation_refs = [r for r in claim.citation_refs if r in valid_ids]
    unbacked = [c for c in draft.material_claims if not c.citation_refs]
    if unbacked and draft.verdict == Verdict.SUPPORTED:
        draft.verdict = Verdict.INSUFFICIENT_EVIDENCE
        draft.explanation = (
            "(Downgraded by citation guard: material claims lack citation-backed "
            "evidence in retrieved excerpts.) " + draft.explanation
        )
    return draft


def draft_verdict(facts: CaseFacts, rejection_reason: str, evidence: list[dict]) -> DraftVerdict:
    prompt = build_reasoning_prompt(facts, rejection_reason, evidence)
    draft = get_llm().generate_structured(prompt, DraftVerdict)
    return enforce_citation_guard(draft, evidence)
