"""Localization: per-turn language detection + EN<->HI translation with
back-translation meaning check (claude.md section 3)."""
import re
from pathlib import Path

from pydantic import BaseModel, Field

from davacheck.llm import get_llm

LOC_PROMPT = Path(__file__).resolve().parent.parent / "prompts" / "localization_v1.md"

# Devanagari presence test — deterministic, no LLM needed
DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")


def detect_language(text: str) -> str:
    return "hi" if DEVANAGARI_RE.search(text) else "en"


class LocalizedOutput(BaseModel):
    translated: str
    numbers_preserved: list[str] = Field(
        default_factory=list, description="numbers/dates/section refs copied verbatim"
    )


def localize(text: str, target_lang: str) -> str:
    if target_lang == "en":
        return text
    template = LOC_PROMPT.read_text(encoding="utf-8")
    prompt = template.replace("{{TEXT}}", text)
    return get_llm().generate_structured(prompt, LocalizedOutput).translated


class MeaningCheck(BaseModel):
    meaning_preserved: bool
    discrepancies: list[str] = Field(default_factory=list)


def backtranslation_check(original_en: str, hindi: str) -> MeaningCheck:
    """Back-translate Hindi to English and compare. Fail-closed: mismatch flags,
    output is not shipped silently (claude.md section 3)."""
    llm = get_llm()
    back = llm.generate_text(
        "Translate this Hindi text to English. Output ONLY the translation, "
        "preserving all numbers and terms exactly:\n\n" + hindi
    )
    return llm.generate_structured(
        "Compare the ORIGINAL and BACK-TRANSLATED texts. Do they convey the same "
        "legal meaning? List any discrepancies in numbers, dates, thresholds, "
        "verdicts, or rule references.\n\n"
        f"ORIGINAL:\n{original_en}\n\nBACK-TRANSLATED:\n{back}\n",
        MeaningCheck,
    )
