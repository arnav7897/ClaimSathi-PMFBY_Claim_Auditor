from fastapi import FastAPI
from pydantic import BaseModel, Field

from davacheck.retrieval import get_index
from davacheck.schemas import AuditResult, CaseFacts

app = FastAPI(title="DavaCheck", version="0.1.0")


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = Field(default=6, ge=1, le=20)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/retrieve")
def retrieve(req: RetrieveRequest) -> dict:
    chunks = get_index().search(req.query, top_k=req.top_k)
    return {"query": req.query, "results": chunks}


@app.post("/case", response_model=CaseFacts)
def create_case(notice_text: str) -> CaseFacts:
    raise NotImplementedError


@app.post("/audit", response_model=AuditResult)
def audit_case(facts: CaseFacts) -> AuditResult:
    raise NotImplementedError
