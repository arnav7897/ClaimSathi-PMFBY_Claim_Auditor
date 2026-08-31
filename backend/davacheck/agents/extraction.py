"""Fact-extraction agent: rejection notice text -> validated CaseFacts."""
from pathlib import Path

from davacheck.llm import get_llm
from davacheck.schemas import CaseFacts, DocType, expected_fields

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "extraction_v1.md"

# Canonical set of extractable fields used to sanitise model output.
VALID_FIELDS = {
    "farmer_name",
    "application_number",
    "policy_number",
    "crop",
    "season",
    "district",
    "state",
    "tehsil",
    "village",
    "incident_date",
    "cause_of_loss",
    "affected_area",
    "loss_percent",
    "category",
    "doc_type",
    "rejection_reason",
    "cited_clause",
    "dates",
}


def extract_facts(notice_text: str) -> CaseFacts:
    prompt = PROMPT_PATH.read_text(encoding="utf-8").replace("{{NOTICE_TEXT}}", notice_text)
    facts = get_llm().generate_structured(prompt, CaseFacts)
    # fail closed: model-invented missing-field names get dropped
    facts.missing_fields = [f for f in facts.missing_fields if f in VALID_FIELDS]
    # drive missing-field bookkeeping from the doc-type-aware expected set
    for field in expected_fields(facts.doc_type):
        if getattr(facts, field, None) is None and field not in facts.missing_fields:
            facts.missing_fields.append(field)
    return facts
