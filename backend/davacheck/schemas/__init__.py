"""Core structured schemas for DavaCheck.

All model-generated structured output must validate against these schemas
before reaching downstream nodes (claude.md section 2).
"""
from enum import Enum

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    SUPPORTED = "SUPPORTED"
    NOT_SUPPORTED = "NOT_SUPPORTED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class ClaimCategory(str, Enum):
    YIELD_SHORTFALL = "yield_shortfall"
    PREVENTED_SOWING = "prevented_sowing"
    MID_SEASON_ADVERSITY = "mid_season_adversity"
    LOCALIZED_CALAMITY = "localized_calamity"
    POST_HARVEST = "post_harvest"
    OTHER = "other"


class DocType(str, Enum):
    REJECTION_NOTICE = "rejection_notice"
    CLAIM_APPLICATION = "claim_application"
    INCIDENT_REPORT = "incident_report"


class CaseFacts(BaseModel):
    # Identification (extracted from any document type)
    farmer_name: str | None = None
    application_number: str | None = None
    policy_number: str | None = None

    # Geography + crop
    crop: str | None = None
    season: str | None = None
    district: str | None = None
    state: str | None = None
    tehsil: str | None = None
    village: str | None = None

    # Loss event
    incident_date: str | None = None
    cause_of_loss: str | None = None  # the peril: flood, waterlogging, drought, etc.
    affected_area: str | None = None
    loss_percent: float | None = None

    # Rejection-only (insurer decision context)
    rejection_reason: str | None = None
    cited_clause: str | None = None

    # Metadata
    category: ClaimCategory = ClaimCategory.OTHER
    doc_type: DocType = DocType.REJECTION_NOTICE
    dates: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)


# Fields that are always required from any document, claim or rejection.
_ALWAYS_TRACKED = {
    "farmer_name",
    "crop",
    "season",
    "district",
    "state",
    "cause_of_loss",
    "incident_date",
    "affected_area",
    "loss_percent",
}

# Rejection-only fields — never required on a claim application / incident report.
_REJECTION_ONLY = {"rejection_reason", "cited_clause"}


def expected_fields(doc_type: DocType) -> set[str]:
    """Return the set of fields the pipeline should expect for this doc type.

    Used by the extraction agent to drive its missing_fields bookkeeping. Keeps
    rejection-only fields out of the missing list for claim documents, and
    keeps farmer-identification fields required for any document.
    """
    base = _ALWAYS_TRACKED
    if doc_type == DocType.REJECTION_NOTICE:
        return base | _REJECTION_ONLY
    return base


class Citation(BaseModel):
    chunk_id: str
    doc_id: str
    section: str
    quote: str


class MaterialClaim(BaseModel):
    claim: str
    citation_refs: list[str] = Field(default_factory=list)
    reasoning: str


class DraftVerdict(BaseModel):
    verdict: Verdict
    material_claims: list[MaterialClaim]
    explanation: str


class AuditResult(BaseModel):
    verdict: Verdict
    explanation: str
    citations: list[Citation] = Field(default_factory=list)
    material_claims: list[MaterialClaim] = Field(default_factory=list)
    missing_facts: list[str] = Field(default_factory=list)
    confidence_flag: str = "normal"


class AuditEvent(BaseModel):
    stage: str
    detail: str
    verdict: Verdict | None = None
