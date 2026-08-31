"""Claim-assessment agent: assess claim eligibility from farmer's incident report."""
from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field

from davacheck.llm import get_llm
from davacheck.schemas import CaseFacts


class AssessmentDimension(str, Enum):
    PERIL_COVERAGE = "peril_coverage"
    CROP_COVERAGE = "crop_coverage"
    LOSS_THRESHOLD = "loss_threshold"
    SEASON_ELIGIBILITY = "season_eligibility"
    AREA_TRIGGERS = "area_triggers"


class ClaimAssessmentEntry(BaseModel):
    dimension: str
    status: str  # COVERED | UNCLEAR_COVERAGE | UNLIKELY_COVERED | MISSING_EVIDENCE
    assessment: str
    policy_refs: list[str] = Field(default_factory=list)


class ClaimAssessmentResult(BaseModel):
    """Assessment of a farmer's claim application against PMFBY policy text."""
    peril_coverage: ClaimAssessmentEntry
    crop_coverage: ClaimAssessmentEntry
    loss_threshold: ClaimAssessmentEntry
    season_eligibility: ClaimAssessmentEntry
    area_triggers: ClaimAssessmentEntry
    summary: str  # Plain-language summary of what the policy says about this claim
    missing_evidence: list[str] = Field(
        default_factory=list,
        description="Specific information not in policy excerpts needed to assess this claim"
    )


PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "claim_assessment_v1.md"


def build_claim_prompt(facts: CaseFacts, notice_text: str, evidence: list[dict]) -> str:
    template = PROMPT_PATH.read_text(encoding="utf-8")
    evidence_block = "\n\n".join(
        f"[{c['chunk_id']}] ({c['section']}) {c['text']}" for c in evidence
    )
    return (
        template.replace("{{FACTS}}", facts.model_dump_json(indent=2))
        .replace("{{NOTICE_TEXT}}", notice_text)
        .replace("{{EVIDENCE}}", evidence_block or "(no excerpts retrieved)")
    )


def assess_claim(facts: CaseFacts, notice_text: str, evidence: list[dict]) -> ClaimAssessmentResult:
    prompt = build_claim_prompt(facts, notice_text, evidence)
    return get_llm().generate_structured(prompt, ClaimAssessmentResult)
