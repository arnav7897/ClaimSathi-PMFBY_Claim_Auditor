from fastapi import FastAPI

from davacheck.schemas import AuditResult, CaseFacts

app = FastAPI(title="DavaCheck", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/case", response_model=CaseFacts)
def create_case(notice_text: str) -> CaseFacts:
    raise NotImplementedError


@app.post("/audit", response_model=AuditResult)
def audit_case(facts: CaseFacts) -> AuditResult:
    raise NotImplementedError
