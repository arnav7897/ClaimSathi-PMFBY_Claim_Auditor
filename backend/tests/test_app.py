from fastapi.testclient import TestClient

import davacheck.app as app_mod
from davacheck.app import app
from davacheck.agents.claim_assessment import ClaimAssessmentEntry, ClaimAssessmentResult
from davacheck.schemas import CaseFacts, DocType
from davacheck.store import create_case

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_claim_assessment_endpoint_routes_without_graph_error(monkeypatch):
    import davacheck.graph as graph_mod

    class FakeIndex:
        def search(self, query, top_k=8):
            return [
                {
                    "chunk_id": "pmfby-og-2023#s5#0",
                    "doc_id": "pmfby-og-2023",
                    "section": "Section 5",
                    "text": "drought, dry spells",
                    "score": 1.0,
                }
            ]

    monkeypatch.setattr(
        graph_mod,
        "extract_facts",
        lambda _: CaseFacts(
            crop="wheat",
            district="Indore",
            state="Madhya Pradesh",
            cause_of_loss="drought",
            doc_type=DocType.CLAIM_APPLICATION,
        ),
    )
    monkeypatch.setattr(graph_mod, "get_index", lambda: FakeIndex())
    monkeypatch.setattr(
        graph_mod,
        "assess_claim",
        lambda *a, **k: ClaimAssessmentResult(
            peril_coverage=ClaimAssessmentEntry(
                dimension="peril_coverage",
                status="COVERED",
                assessment="Drought is covered.",
                policy_refs=["pmfby-og-2023#s5#0"],
            ),
            crop_coverage=ClaimAssessmentEntry(
                dimension="crop_coverage",
                status="COVERED",
                assessment="Crop is covered.",
                policy_refs=["pmfby-og-2023#s5#0"],
            ),
            loss_threshold=ClaimAssessmentEntry(
                dimension="loss_threshold",
                status="COVERED",
                assessment="Loss threshold met.",
                policy_refs=["pmfby-og-2023#s5#0"],
            ),
            season_eligibility=ClaimAssessmentEntry(
                dimension="season_eligibility",
                status="COVERED",
                assessment="Season is eligible.",
                policy_refs=["pmfby-og-2023#s5#0"],
            ),
            area_triggers=ClaimAssessmentEntry(
                dimension="area_triggers",
                status="COVERED",
                assessment="Area trigger satisfied.",
                policy_refs=["pmfby-og-2023#s5#0"],
            ),
            summary="Drought claim appears covered.",
            missing_evidence=[],
        ),
    )

    case_id = create_case(CaseFacts(crop="wheat", district="Indore"), "incident text")
    body = app_mod.assess_claim(case_id=case_id, language="en")
    assert body["result"]["verdict"].value == "SUPPORTED"
    assert any(event["stage"] == "claim_finalize" for event in body["audit_events"])
