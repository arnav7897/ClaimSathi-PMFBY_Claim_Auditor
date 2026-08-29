from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from davacheck.agents.extraction import extract_facts
from davacheck.agents.grievance import GrievanceDraft, approve_draft
from davacheck.agents.ocr import ocr_image
from davacheck.agents.scope import ScopeDecision, answer_followup, check_scope
from davacheck.graph import build_graph
from davacheck.retrieval import get_index
from davacheck.schemas import AuditResult, CaseFacts
from davacheck.store import create_case, get_case

app = FastAPI(title="DavaCheck", version="0.1.0")


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = Field(default=6, ge=1, le=20)


class CaseRequest(BaseModel):
    notice_text: str = Field(min_length=20)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/retrieve")
def retrieve(req: RetrieveRequest) -> dict:
    chunks = get_index().search(req.query, top_k=req.top_k)
    return {"query": req.query, "results": chunks}


@app.post("/case/ocr")
async def case_ocr(image: UploadFile = File(...)) -> dict:
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty image")
    result = ocr_image(image_bytes, content_type=image.content_type or "image/jpeg")
    return result.model_dump()


@app.post("/case")
def create_case_endpoint(req: CaseRequest) -> dict:
    facts = extract_facts(req.notice_text)
    case_id = create_case(facts, req.notice_text)
    return {"case_id": case_id, "facts": facts.model_dump()}


@app.post("/case", response_model=CaseFacts)
def create_case(notice_text: str) -> CaseFacts:
    raise NotImplementedError


@app.post("/audit")
def audit_case(case_id: str, language: str = "en") -> dict:
    case = get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    graph = build_graph()
    state = graph.invoke({"notice_text": case["notice_text"], "language": language})
    result: AuditResult = state["result"]
    events: list = state.get("events", [])
    case["result"] = result
    return {"result": result.model_dump(), "audit_events": [e.model_dump() for e in events],
            "grievance_draft": state.get("grievance_draft")}


class GrievanceApproval(BaseModel):
    case_id: str


@app.post("/grievance/approve")
def approve_grievance(req: GrievanceApproval) -> dict:
    case = get_case(req.case_id)
    if case is None or case.get("grievance_draft") is None:
        raise HTTPException(status_code=404, detail="no grievance draft for case")
    approved = approve_draft(GrievanceDraft.model_validate(case["grievance_draft"]))
    case["grievance_draft"] = approved.model_dump()
    return {"grievance_draft": approved.model_dump()}


class FollowUpRequest(BaseModel):
    case_id: str
    turn: str = Field(min_length=2)


@app.post("/case/followup")
def followup(req: FollowUpRequest) -> dict:
    case = get_case(req.case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    scope = check_scope(req.turn)
    if scope.decision == ScopeDecision.OUT_OF_SCOPE:
        return {"decision": "declined", "reason": scope.reason, "answer": None}
    if scope.decision == ScopeDecision.CLARIFY:
        return {"decision": "clarify", "reason": scope.reason, "answer": None}
    result = case.get("result")
    answer = answer_followup(
        req.turn, case["facts"],
        result.verdict.value if result else "(no audit yet)",
        result.explanation if result else "(no audit yet)",
        result.citations if result else [],
    )
    return {"decision": "answered", "reason": scope.reason, "answer": answer.answer}
