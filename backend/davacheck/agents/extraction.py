"""Fact-extraction agent: rejection notice text -> validated CaseFacts."""
from pathlib import Path

from davacheck.llm import get_llm
from davacheck.schemas import CaseFacts

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "extraction_v1.md"

VALID_FIELDS = {"crop", "season", "district", "state", "rejection_reason", "cited_clause"}


def extract_facts(notice_text: str) -> CaseFacts:
    prompt = PROMPT_PATH.read_text(encoding="utf-8").replace("{{NOTICE_TEXT}}", notice_text)
    facts = get_llm().generate_structured(prompt, CaseFacts)
    # fail closed: model-invented missing-field names get dropped
    facts.missing_fields = [f for f in facts.missing_fields if f in VALID_FIELDS]
    for field in VALID_FIELDS:
        if getattr(facts, field) is None and field not in facts.missing_fields:
            facts.missing_fields.append(field)
    return facts
