import pytest

from davacheck.retrieval import get_index

# Known-rule queries must surface the correct policy section in top-3.
# Section mapping verified against ingested corpus: TY formula in S7
# (Notification/Tender), prevented sowing in S5 (Coverage of Risks),
# seasonality/cut-off in S16, sum insured in S12, premium in S13.
KNOWN_QUERIES = [
    ("threshold yield formula best 5 year yield indemnity level", "7"),
    ("prevented sowing planting germination deficit rainfall adverse conditions", "5"),
    ("seasonality discipline cut-off dates enrolment farmers", "16"),
    ("sum insured scale of finance or notional value", "12"),
    ("premium rates farmers share government subsidy", "13"),
]


@pytest.mark.parametrize("query,expected_section", KNOWN_QUERIES)
def test_known_concept_hits_expected_section(query, expected_section):
    results = get_index().search(query, top_k=3)
    assert results, f"no results for: {query}"
    sections = [r["section"].split()[-1] for r in results]
    assert expected_section in sections, f"{expected_section} not in top-3 {sections} for: {query}"


def test_results_carry_chunk_metadata():
    results = get_index().search("prevented sowing due to deficit rainfall", top_k=2)
    for r in results:
        assert r["chunk_id"].startswith("pmfby-og-2023#s")
        assert r["doc_id"] == "pmfby-og-2023"
        assert r["text"]
        assert r["score"] > 0


def test_gibberish_query_returns_empty():
    assert get_index().search("zzqxv bbff nnmmpqqq", top_k=3) == []
