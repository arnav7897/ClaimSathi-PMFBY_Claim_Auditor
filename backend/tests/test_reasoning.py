from davacheck.agents.reasoning import enforce_citation_guard, build_reasoning_prompt
from davacheck.schemas import CaseFacts, DraftVerdict, MaterialClaim, Verdict

EVIDENCE = [
    {"chunk_id": "pmfby-og-2023#s5#0", "section": "Section 5", "text": "Prevented sowing cover..."},
    {"chunk_id": "pmfby-og-2023#s7#13", "section": "Section 7", "text": "TY formula..."},
]


def test_guard_downgrades_supported_with_unbacked_claim():
    draft = DraftVerdict(
        verdict=Verdict.SUPPORTED,
        material_claims=[
            MaterialClaim(reasoning="r", claim="sowing was late", citation_refs=[]),
            MaterialClaim(reasoning="r", claim="cut-off applies", citation_refs=["pmfby-og-2023#s7#13"]),
        ],
        explanation="draft",
    )
    guarded = enforce_citation_guard(draft, EVIDENCE)
    assert guarded.verdict == Verdict.INSUFFICIENT_EVIDENCE
    assert "citation guard" in guarded.explanation


def test_guard_strips_fabricated_refs():
    draft = DraftVerdict(
        verdict=Verdict.NOT_SUPPORTED,
        material_claims=[
            MaterialClaim(
                reasoning="r",
                claim="policy says X",
                citation_refs=["pmfby-og-2023#s99#99", "pmfby-og-2023#s5#0"],
            )
        ],
        explanation="draft",
    )
    guarded = enforce_citation_guard(draft, EVIDENCE)
    assert guarded.material_claims[0].citation_refs == ["pmfby-og-2023#s5#0"]
    # NOT_SUPPORTED with at least one valid ref survives the guard
    assert guarded.verdict == Verdict.NOT_SUPPORTED


def test_guard_keeps_valid_supported():
    draft = DraftVerdict(
        verdict=Verdict.SUPPORTED,
        material_claims=[
            MaterialClaim(reasoning="r", claim="rule 5.2.1 applies", citation_refs=["pmfby-og-2023#s5#0"])
        ],
        explanation="draft",
    )
    assert enforce_citation_guard(draft, EVIDENCE).verdict == Verdict.SUPPORTED


def test_prompt_includes_evidence_ids():
    facts = CaseFacts(crop="paddy")
    prompt = build_reasoning_prompt(facts, "late sowing", EVIDENCE)
    assert "pmfby-og-2023#s5#0" in prompt
    assert "late sowing" in prompt
    assert "paddy" in prompt
