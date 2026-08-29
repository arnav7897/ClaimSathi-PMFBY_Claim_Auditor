from davacheck.citations import build_citations, finalize_audit
from davacheck.schemas import MaterialClaim, Verdict

EVIDENCE = [
    {"chunk_id": "pmfby-og-2023#s5#0", "doc_id": "pmfby-og-2023", "section": "Section 5", "text": "Prevented sowing cover text."},
]


def test_build_citations_blocks_fabricated():
    claims = [MaterialClaim(reasoning="r", claim="x", citation_refs=["fake#s1#0", "pmfby-og-2023#s5#0"])]
    citations, events = build_citations(claims, EVIDENCE)
    assert [c.chunk_id for c in citations] == ["pmfby-og-2023#s5#0"]
    assert any("fabricated" in e.detail for e in events)


def test_supported_without_citations_blocked():
    result, events = finalize_audit(Verdict.SUPPORTED, "exp", [], EVIDENCE)
    assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE
    assert any("no citations" in e.detail for e in events)


def test_supported_with_citations_passes():
    claims = [MaterialClaim(reasoning="r", claim="x", citation_refs=["pmfby-og-2023#s5#0"])]
    result, _ = finalize_audit(Verdict.SUPPORTED, "exp", claims, EVIDENCE)
    assert result.verdict == Verdict.SUPPORTED
    assert result.citations[0].quote.startswith("Prevented sowing")
