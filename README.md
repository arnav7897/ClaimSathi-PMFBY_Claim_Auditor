# DavaCheck

Evidence-grounded auditor for PMFBY claim rejections. Answers one narrow question:
**is the stated rejection reason supported by policy evidence?** — with verdict
`SUPPORTED` / `NOT_SUPPORTED` / `INSUFFICIENT_EVIDENCE`, source citations, and a
human-reviewed grievance draft when warranted.

## Architecture

See `architecture.md`. Pipeline: OCR/typed intake → fact extraction → BM25
retrieval over PMFBY corpus → reasoning agent → verification agent (fail-closed)
→ localization (EN/HI) → grievance draft (conditional) → mandatory human review.
Orchestrated as a LangGraph state machine.

## Setup

Requirements: Python 3.12, Node 18+.

```bash
# backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp ../.env.example ../.env      # then edit .env and set GEMINI_API_KEY

# run API
.venv/bin/uvicorn davacheck.app:app --port 8000

# tests
.venv/bin/python -m pytest -q
```

```bash
# frontend
cd frontend
npm install
npm run dev      # http://localhost:5173
```

## Environment variables

| Var | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API access (required for LLM endpoints) | — |
| `GEMINI_MODEL` | Model id | `gemini-2.5-flash` |

## Commands

```bash
# ingest policy corpus (already committed, re-run only after adding raw docs)
cd backend && .venv/bin/python scripts/ingest_policy.py

# evaluation: baseline vs pipeline on the fixed 12-case dataset (needs API key)
cd backend && .venv/bin/python -m eval.run_eval
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /retrieve` | BM25 search over policy corpus |
| `POST /case/ocr` | photo → extracted text (unverified until user confirms) |
| `POST /case` | notice text → extracted `CaseFacts`, returns `case_id` |
| `POST /audit?case_id=&language=en\|hi` | full audit; returns verdict, citations, audit trail, grievance draft |
| `POST /grievance/approve` | human approval gate for the draft |
| `POST /case/followup` | case-scoped Q&A with scope guardrails |

## Safety properties

- Fail closed: missing/conflicting evidence ⇒ `INSUFFICIENT_EVIDENCE`, never a guess.
- Citation guard: verdicts citing absent chunks are blocked at code level.
- Verification: every material claim checked against retrieved text before output.
- No auto-submission: grievance drafts require explicit human approval.
- Development uses synthetic cases and public documents only — no real farmer PII.
