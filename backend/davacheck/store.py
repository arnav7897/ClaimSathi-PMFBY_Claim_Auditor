"""Minimal in-memory case store for the current session."""
import uuid

from davacheck.schemas import CaseFacts

_cases: dict[str, dict] = {}


def create_case(facts: CaseFacts, notice_text: str, image_ref: str | None = None) -> str:
    case_id = uuid.uuid4().hex[:12]
    _cases[case_id] = {
        "case_id": case_id,
        "facts": facts,
        "notice_text": notice_text,
        "image_ref": image_ref,
        "ocr_verified": image_ref is None,
    }
    return case_id


def get_case(case_id: str) -> dict | None:
    return _cases.get(case_id)
