from davacheck.agents.extraction import VALID_FIELDS
from davacheck.schemas import CaseFacts, ClaimCategory, Verdict


def test_case_facts_defaults_fail_closed():
    facts = CaseFacts()
    assert facts.crop is None
    assert facts.category == ClaimCategory.OTHER
    assert facts.missing_fields == []


def test_case_facts_roundtrip():
    facts = CaseFacts(
        crop="paddy",
        season="kharif 2023",
        district="Bilaspur",
        rejection_reason="sowing done after cut-off date",
        category=ClaimCategory.PREVENTED_SOWING,
        missing_fields=["state"],
    )
    dumped = facts.model_dump()
    assert CaseFacts.model_validate(dumped) == facts


def test_valid_fields_are_schema_fields():
    schema_fields = set(CaseFacts.model_fields.keys())
    assert VALID_FIELDS <= schema_fields


def test_verdict_enum_exact():
    assert {v.value for v in Verdict} == {"SUPPORTED", "NOT_SUPPORTED", "INSUFFICIENT_EVIDENCE"}
