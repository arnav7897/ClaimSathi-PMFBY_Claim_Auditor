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
    OTHER = "other"


class CaseFacts(BaseModel):
    crop: str | None = None
    season: str | None = None
    district: str | None = None
    state: str | None = None
    rejection_reason: str | None = None
    cited_clause: str | None = None
    category: ClaimCategory = ClaimCategory.OTHER
    dates: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)


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
