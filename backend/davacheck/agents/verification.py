"""Verification agent: checks each material claim against retrieved evidence.

Separate from generation (claude.md section 2). Verification can revise or
reject claims and downgrade the verdict. Downgrade policy is deterministic
code, not prompt discretion.
"""
from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field

from davacheck.llm import get_llm
from davacheck.schemas import AuditEvent, DraftVerdict, MaterialClaim, Verdict

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "verification_v1.md"


class ClaimCheck(str, Enum):
    PASS = "pass"
    REVISE = "revise"
    REJECT = "reject"


class ClaimVerdict(BaseModel):
    claim_index: int
    check: ClaimCheck
    revised_claim: str | None = None
    justification: str


class VerificationReport(BaseModel):
    claim_checks: list[ClaimVerdict]
    evidence_conflicting: bool = Field(
        default=False, description="cited excerpts contradict each other"
    )


def build_verification_prompt(claims: list[MaterialClaim], evidence: list[dict]) -> str:
    template = PROMPT_PATH.read_text(encoding="utf-8")
    claims_block = "\n".join(
        f"{i}. {c.claim} [cites: {', '.join(c.citation_refs) or 'NONE'}]"
        for i, c in enumerate(claims)
    )
    evidence_block = "\n\n".join(
        f"[{c['chunk_id']}] ({c['section']}) {c['text']}" for c in evidence
    )
    return template.replace("{{CLAIMS}}", claims_block or "(none)").replace(
        "{{EVIDENCE}}", evidence_block or "(none)"
    )


def apply_verification(draft: DraftVerdict, report: VerificationReport) -> tuple[DraftVerdict, list[AuditEvent]]:
    """Deterministic downgrade policy:
    - any rejected claim, or conflicting evidence, on SUPPORTED -> INSUFFICIENT_EVIDENCE
    - any rejected claim on NOT_SUPPORTED -> INSUFFICIENT_EVIDENCE (reject the rejection
      audit conclusion too — evidence does not establish it)
    - revised claims replace their text; citation refs preserved
    """
    events: list[AuditEvent] = []
    checks = {c.claim_index: c for c in report.claim_checks}

    revised_claims: list[MaterialClaim] = []
    n_rejected = 0
    for i, claim in enumerate(draft.material_claims):
        check = checks.get(i)
        if check is None:
            revised_claims.append(claim)
            continue
        if check.check == ClaimCheck.REJECT:
            n_rejected += 1
            events.append(
                AuditEvent(stage="verification", detail=f"claim rejected: {claim.claim} — {check.justification}")
            )
        elif check.check == ClaimCheck.REVISE and check.revised_claim:
            revised_claims.append(
                claim.model_copy(update={"claim": check.revised_claim})
            )
            events.append(
                AuditEvent(stage="verification", detail=f"claim revised: '{claim.claim}' -> '{check.revised_claim}'")
            )
        else:
            revised_claims.append(claim)

    draft.material_claims = revised_claims

    if (n_rejected > 0 or report.evidence_conflicting) and draft.verdict != Verdict.INSUFFICIENT_EVIDENCE:
        events.append(
            AuditEvent(
                stage="verification",
                detail=f"downgraded from {draft.verdict.value}: {n_rejected} rejected claims, conflicting={report.evidence_conflicting}",
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
            )
        )
        draft.verdict = Verdict.INSUFFICIENT_EVIDENCE
        draft.explanation = (
            "(Verification downgraded this verdict: not all material claims survived "
            "evidence checking.) " + draft.explanation
        )
    return draft, events


def verify_draft(draft: DraftVerdict, evidence: list[dict]) -> tuple[DraftVerdict, list[AuditEvent]]:
    prompt = build_verification_prompt(draft.material_claims, evidence)
    report = get_llm().generate_structured(prompt, VerificationReport)
    return apply_verification(draft, report)
