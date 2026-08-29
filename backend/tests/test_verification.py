"""Verification agent tests, including the adversarial demo case:
reasoning drafts an overconfident SUPPORTED conclusion; verification must
catch the unsupported claim and downgrade."""
from davacheck.agents.verification import (
    ClaimCheck,
    ClaimVerdict,
    VerificationReport,
    apply_verification,
    build_verification_prompt,
)
from davacheck.schemas import DraftVerdict, MaterialClaim, Verdict

EVIDENCE = [
    {
        "chunk_id": "pmfby-og-2023#s5#0",
        "section": "Section 5",
        "text": "5.2.1 Prevented Sowing/Planting/Germination Risk: Insured area is prevented from sowing/planting/germination due to deficit rainfall or adverse seasonal/climatic conditions.",
    }
]


def _adversarial_draft() -> DraftVerdict:
    return DraftVerdict(
        verdict=Verdict.SUPPORTED,
        material_claims=[
            MaterialClaim(
                reasoning="r",
                claim="Insurer denied claim because sowing was prevented by deficit rainfall, which Section 5.2.1 covers as an add-on",
                citation_refs=["pmfby-og-2023#s5#0"],
            ),
            # adversarial: policy text says NOTHING about a 15-day window
            MaterialClaim(
                reasoning="r",
                claim="Claims under prevented sowing must be filed within 15 days of the cut-off date",
                citation_refs=["pmfby-og-2023#s5#0"],
            ),
        ],
        explanation="Rejection is supported by policy.",
    )


def test_adversarial_unsupported_claim_downgrades_supported():
    report = VerificationReport(
        claim_checks=[
            ClaimVerdict(claim_index=0, check=ClaimCheck.PASS, justification="directly stated"),
            ClaimVerdict(
                claim_index=1, check=ClaimCheck.REJECT, justification="no 15-day window in excerpt"
            ),
        ]
    )
    result, events = apply_verification(_adversarial_draft(), report)
    assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE
    assert any("downgraded" in e.detail for e in events)
    assert "Verification downgraded" in result.explanation


def test_rejected_claim_removed_from_material_claims():
    report = VerificationReport(
        claim_checks=[
            ClaimVerdict(claim_index=0, check=ClaimCheck.PASS, justification="ok"),
            ClaimVerdict(claim_index=1, check=ClaimCheck.REJECT, justification="invented"),
        ]
    )
    result, _ = apply_verification(_adversarial_draft(), report)
    assert len(result.material_claims) == 1
    assert "15 days" not in result.material_claims[0].claim


def test_revise_updates_claim_text_keeps_refs():
    report = VerificationReport(
        claim_checks=[
            ClaimVerdict(
                claim_index=0,
                check=ClaimCheck.REVISE,
                revised_claim="Prevented sowing is an optional add-on cover chosen by the State",
                justification="excerpt says add-on, not mandatory",
            ),
            ClaimVerdict(claim_index=1, check=ClaimCheck.PASS, justification="ok"),
        ]
    )
    result, events = apply_verification(_adversarial_draft(), report)
    assert "optional add-on" in result.material_claims[0].claim
    assert result.material_claims[0].citation_refs == ["pmfby-og-2023#s5#0"]
    assert any("revised" in e.detail for e in events)


def test_conflicting_evidence_downgrades():
    report = VerificationReport(
        claim_checks=[ClaimVerdict(claim_index=0, check=ClaimCheck.PASS, justification="ok")],
        evidence_conflicting=True,
    )
    result, events = apply_verification(_adversarial_draft(), report)
    assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE


def test_clean_pass_keeps_supported():
    report = VerificationReport(
        claim_checks=[
            ClaimVerdict(claim_index=0, check=ClaimCheck.PASS, justification="ok"),
            ClaimVerdict(claim_index=1, check=ClaimCheck.PASS, justification="ok"),
        ]
    )
    result, events = apply_verification(_adversarial_draft(), report)
    assert result.verdict == Verdict.SUPPORTED
    assert events == []


def test_prompt_lists_claims_and_evidence():
    prompt = build_verification_prompt(_adversarial_draft().material_claims, EVIDENCE)
    assert "cites: pmfby-og-2023#s5#0" in prompt
    assert "15 days" in prompt
    assert "Prevented Sowing/Planting/Germination Risk" in prompt
