# implementation.md

Source of truth for project state. Keep under 100 lines.

## Completed

- **Phase 0 — Scaffolding.** Committed `prd.md` + `claude.md`. Wrote `plan.md`
  (phase-wise, microcommit plan). Backend: FastAPI app under `backend/davacheck/`,
  core schemas (`Verdict` 3-value enum, `CaseFacts`, `Citation`, `MaterialClaim`,
  `DraftVerdict`, `AuditResult`, `AuditEvent`), `config.py` (pydantic-settings),
  health endpoint, one passing test. `.env.example` checked in, `.env` gitignored.
  Frontend: Vite + React + TS + Tailwind v3 under `frontend/`, palette tokens per
  claude.md §8 (navy/ink/danger/approved, Inter + JetBrains Mono), placeholder
  App shell, `tsc` + `vite build` clean.

## Stack

Python 3.12 / FastAPI / Pydantic v2 / google-genai (Gemini) / rank-bm25 /
LangGraph | Vite + React + TS + Tailwind v3.

## Key decisions

- Verdicts locked to SUPPORTED / NOT_SUPPORTED / INSUFFICIENT_EVIDENCE (schema enum).
- Env via `backend/davacheck/config.py`; model name configurable via `GEMINI_MODEL`.
- `/case` and `/audit` endpoints stubbed with `NotImplementedError` — next phases.

## Current limitations

- No policy corpus yet — retrieval not implemented.
- No LLM calls wired; no `GEMINI_API_KEY` present in env yet.
- No OCR, no verification, no eval harness, no frontend logic beyond shell.

## Tests

- `backend/tests/test_app.py` — health endpoint. Run: `cd backend && .venv/bin/python -m pytest -q`.

## Next phase

Phase 1: PMFBY policy corpus loader + BM25 retrieval index + `/retrieve` endpoint.
