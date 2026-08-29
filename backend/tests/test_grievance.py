from davacheck.agents.grievance import GrievanceDraft, approve_draft
from davacheck.schemas import AuditResult, CaseFacts, Citation, MaterialClaim, Verdict
from davacheck.agents.grievance import draft_grievance


AUDIT = AuditResult(
    verdict=Verdict.NOT_SUPPORTED,
    explanation="Policy covers drought.",
    citations=[Citation(chunk_id="pmfby-og-2023#s5#0", doc_id="pmfby-og-2023",
                        section="Section 5", quote="drought covered")],
    material_claims=[MaterialClaim(reasoning="r", claim="drought is covered",
                                   citation_refs=["pmfby-og-2023#s5#0"])],
)


def test_supported_verdict_produces_no_draft():
    audit = AUDIT.model_copy(update={"verdict": Verdict.SUPPORTED})
    # verdict SUPPORTED short-circuits before any LLM call
    assert draft_grievance(audit, CaseFacts()) is None


def test_draft_starts_unapproved():
    class FakeLLM:
        def generate_structured(self, prompt, schema):
            return schema(subject="s", body="b", language="en")

    import davacheck.agents.grievance as g
    orig = g.get_llm
    g.get_llm = lambda: FakeLLM()
    try:
        draft = draft_grievance(AUDIT, CaseFacts(crop="paddy"))
    finally:
        g.get_llm = orig
    assert draft is not None
    assert draft.approved is False


def test_approval_gate_flips_flag():
    draft = GrievanceDraft(subject="s", body="b", language="en")
    assert draft.approved is False
    approved = approve_draft(draft)
    assert approved.approved is True
    # original untouched
    assert draft.approved is False
