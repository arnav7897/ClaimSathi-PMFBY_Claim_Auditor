"""Grievance drafting: only for verdicts != SUPPORTED; mandatory human review.

No auto-submit, no external action ever (claude.md section 2)."""
from pathlib import Path

from pydantic import BaseModel, Field

from davacheck.llm import get_llm
from davacheck.schemas import AuditResult, Verdict

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "grievance_v1.md"


class GrievanceDraft(BaseModel):
    subject: str
    body: str
    language: str
    approved: bool = Field(
        default=False, description="true only after explicit human approval"
    )


def draft_grievance(audit: AuditResult, case_facts, language: str = "en") -> GrievanceDraft | None:
    if audit.verdict == Verdict.SUPPORTED:
        return None
    evidence_block = "\n\n".join(
        f"[{c.chunk_id}] ({c.section}) {c.quote}" for c in audit.citations
    )
    template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = (
        template.replace("{{VERDICT}}", audit.verdict.value)
        .replace("{{EXPLANATION}}", audit.explanation)
        .replace("{{CLAIMS}}", "\n".join(f"- {c.claim}" for c in audit.material_claims) or "(none)")
        .replace("{{EVIDENCE}}", evidence_block or "(none)")
        .replace("{{FACTS}}", case_facts.model_dump_json(indent=2))
        .replace("{{LANGUAGE}}", "English" if language == "en" else "Hindi (Devanagari script)")
    )
    draft = get_llm().generate_structured(prompt, GrievanceDraft)
    draft.language = language
    return draft


def approve_draft(draft: GrievanceDraft) -> GrievanceDraft:
    """Explicit human approval gate. The draft cannot leave the system unapproved."""
    return draft.model_copy(update={"approved": True})
