from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from davacheck.agents.extraction import extract_facts
from davacheck.agents.ocr import ocr_image
from davacheck.retrieval import get_index
from davacheck.schemas import AuditResult, CaseFacts
from davacheck.store import create_case

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


@app.post("/audit", response_model=AuditResult)
def audit_case(case_id: str) -> AuditResult:
    raise NotImplementedError
