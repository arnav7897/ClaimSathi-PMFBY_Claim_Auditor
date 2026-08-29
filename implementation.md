# implementation.md

Source of truth for project state. Keep under 100 lines.

## Completed

- **Phase 0 — Scaffolding.** Docs committed, plan.md, FastAPI backend, core
  schemas, Vite+React+TS+Tailwind frontend with claude.md §8 palette tokens.
- **Phase 1 — Corpus + BM25 retrieval.** PMFBY Operational Guidelines 2023
  (official PDF, 213pp) ingested: 345 section-aware chunks, deterministic IDs.
  rank-bm25 index, `/retrieve` endpoint, tests pin known rules to sections.
  Fixed: annexure numbering collided with main sections (sequential filter).
- **Phase 2 — Extraction + OCR.** `/case` (Gemini structured → CaseFacts,
  fail-closed missing_fields), `/case/ocr` (Gemini vision, text marked unverified).
- **Phase 3 — Reasoning.** `reasoning_v1` prompt, DraftVerdict + material claims.
  Code-level citation guard: SUPPORTED with unbacked claims ⇒ INSUFFICIENT_EVIDENCE.
- **Phase 4 — Verification.** pass/revise/reject per claim, deterministic
  downgrade policy, adversarial test (fabricated 15-day rule caught).
  `citations.py` blocks fabricated chunk refs; SUPPORTED-without-citations impossible.
- **Phase 5 — Eval harness.** 12-case dataset (4/4/4, incl. 2 adversarial) from
  actual OG-2023 text. `eval.run_eval`: baseline arm (single prompt, same docs)
  vs pipeline arm; verdict accuracy, citation coverage, hallucination rate.
- **Phase 6 — Localization.** Per-turn Devanagari detection, terminology table,
  back-translation meaning check (fail-flagged).
- **Phase 7 — Grievance + review gate.** Drafts only when verdict ≠ SUPPORTED;
  explicit human approval; no auto-submit anywhere.
- **Phase 8 — Orchestration.** LangGraph state machine (intake→retrieval→
  reasoning→verification→localization→grievance). Scope guard (in/out/clarify),
  follow-up Q&A case-scoped, guardrail + follow-up endpoints.
- **Phase 9 — Frontend.** Full flow: OCR upload, facts confirm (mono, unverified
  flag), verdict badges (flat, role colors), claims↔evidence side-by-side,
  missing-facts panel, grievance approval, follow-up, audit trail.
- **Phase 10 — Docs.** README + architecture.md synced; backend smoke-tested live
  (`/health`, `/retrieve` verified via curl).

## Stack

Python 3.12 / FastAPI / Pydantic v2 / google-genai (Gemini) / rank-bm25 /
LangGraph | Vite + React + TS + Tailwind v3.

## Current limitations

- **`GEMINI_API_KEY` not yet set** — LLM endpoints + eval untested against live
  API. Run `.venv/bin/python -m eval.run_eval` after key is added; record numbers.
- Playwright e2e not run (MCP unavailable in session) — manual browser check pending.
- Case store in-memory (resets on restart) — fine for v1 scope.
- Frontend OCR flow: confirm step present; image-ref persistence basic (/tmp).

## Tests

37 passing: schemas, retrieval, reasoning guard, verification downgrade
(adversarial), citations, grievance gate, scope/followup, localization detect.
Run: `cd backend && .venv/bin/python -m pytest -q`.

## Next steps

1. Set `GEMINI_API_KEY`, run eval, record measured baseline-vs-pipeline numbers.
2. Browser e2e: adversarial case (eval-004) demo — verification downgrade visible.
3. Update improvement changelog (PRD §11.4) with measured results.
