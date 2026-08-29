# DavaCheck Build Plan

## Context

Greenfield build of **DavaCheck** — evidence-grounded PMFBY claim-rejection auditor per `prd.md` + `claude.md`. Repo currently empty except both docs. User asks for phase-wise `plan.md` in repo with microcommits; this plan file is that plan (step 0 copies it to `plan.md`).

**Stack (user-confirmed):** Gemini API (LLM + multimodal OCR), BM25 (rank-bm25) retrieval, React + Vite + Tailwind frontend, Python backend, LangGraph orchestration.

**Core invariant (claude.md §1):** three verdicts only — `SUPPORTED` / `NOT_SUPPORTED` / `INSUFFICIENT_EVIDENCE`. Fail closed. Zero fabricated citations. Every material claim traceable to retrieved text.

**48-hour scope discipline (claude.md §11):** core audit path first; OCR, follow-up memory secondary. Never compromise core path.

## Conventions (all phases)

- Python 3.12, `uv` or `pip` + `requirements.txt` pinned.
- Backend: FastAPI. Frontend: Vite + React + TS + Tailwind.
- Gemini via `google-genai` SDK; model name + version logged per run (claude.md §6).
- All LLM structured output validated with Pydantic schemas before downstream nodes (claude.md §2).
- Microcommits: small, scoped, imperative mood, **no co-author trailers** (claude.md §10). Commit message format below.
- `implementation.md` updated immediately after every phase, kept <100 lines (claude.md §4).
- Secrets in `.env`, checked-in `.env.example` only (claude.md §9).

---

## Phase 0 — Scaffolding

| Microcommit | Content |
|---|---|
| `Add PRD and project guidelines` | Commit existing `prd.md`, `claude.md` (untracked). |
| `Add phase-wise build plan` | Write `plan.md` (copy of this file), commit. |
| `Scaffold Python backend package` | `backend/` — FastAPI app skeleton, `schemas/`, `agents/`, `retrieval/`, `tests/`. Pydantic base schemas: `CaseFacts`, `Evidence`, `Verdict`, `Citation`, `AuditEvent`. Commit. |
| `Add env config and .env.example` | Settings module (`pydantic-settings`): `GEMINI_API_KEY`, model names, paths. Commit. |
| `Scaffold Vite React frontend` | Vite + React + TS + Tailwind, palette CSS variables per claude.md §8 (navy `#0B3C5D`, ink `#111827`, red `#D32F2F`, green `#1B5E20`, teal/green accents, flat 1–2px borders, mono font for figures/dates/IDs). Commit. |

**Acceptance:** `uvicorn` boots; frontend dev server boots with palette tokens; `pytest` collects empty suite; both docs committed.

---

## Phase 1 — Policy Corpus + BM25 Retrieval

| Microcommit | Content |
|---|---|
| `Add PMFBY policy corpus loader` | `data/policy/` — ingested public PMFBY guidelines/revamped-circulars/operational instructions (team-curated, cited to source URLs in a `manifest.json`: doc id, title, source URL, section map). Loader chunks by section with stable deterministic chunk IDs (`{doc_id}#s{section}#{i}`). Commit. |
| `Add BM25 retrieval index` | `rank-bm25` + simple tokenizer. Deterministic, testable. Save/serialize index. Commit. |
| `Add retrieval API endpoint` | `POST /retrieve` → top-k chunks per query, returns chunks with doc id + section + exact text. Commit. |
| `Add retrieval tests` | Query set for known concepts (threshold yield, prevented sowing, cut-off date) must return expected doc/section in top-3. Commit. |

**Acceptance:** known-rule queries hit correct sections; retrieval pure-code, no LLM.

---

## Phase 2 — OCR + Case-Fact Extraction

| Microcommit | Content |
|---|---|
| `Add text-input case endpoint` | `POST /case` accepts typed rejection notice text + crop/season/district. Commit. |
| `Add fact-extraction agent` | Gemini structured output → `CaseFacts` schema (crop, season, district, stated rejection reason, cited clause if any, dates). Validate; missing fields flagged, not guessed. Commit. |
| `Add multimodal OCR endpoint` | `POST /case/ocr` — image → Gemini vision extraction → raw text shown back to user for sanity check (untrusted input, claude.md §8). Store original image ref. Commit. |
| `Add extraction tests` | Schema validation, missing-field flagging, OCR output marked unverified until user confirms. Commit. |

**Acceptance:** typed + photo path both produce validated `CaseFacts`; user sees extracted text before reasoning runs.

---

## Phase 3 — Reasoning Agent (core audit)

| Microcommit | Content |
|---|---|
| `Add reasoning agent with clause comparison` | Compares stated rejection reason vs retrieved clauses → draft verdict + material claims list. Output: per-claim `{claim, citation_refs, reasoning}`. Prompt versioned in `prompts/` as reviewable files (claude.md §6). Commit. |
| `Add verdict schema + hard guard` | Any verdict claim without a valid citation ref → forced `INSUFFICIENT_EVIDENCE` at code level, not prompt level. Commit. |
| `Add reasoning tests` | Golden cases: supported rejection, unsupported rejection, missing evidence → assert verdict + claim-citation binding. Commit. |

**Acceptance:** rule-based comparison on the 2 v1 categories (yield shortfall, prevented sowing); no verdict emits without citations.

---

## Phase 4 — Verification Agent (core differentiator)

| Microcommit | Content |
|---|---|
| `Add verification agent` | For each material claim: locate exact retrieved text, check evidence says what claim asserts. Verdict: pass / revise / downgrade. Separate from generation (claude.md §2). Commit. |
| `Add downgrade-to-ambiguous logic` | Weak/conflicting evidence → `INSUFFICIENT_EVIDENCE`, never overconfident (PRD §6.2). Deterministic policy in code. Commit. |
| `Add adversarial test case` | Reasoning drafts unsupported conclusion; verification must catch and downgrade. This is the demo centerpiece (claude.md §7). Commit. |
| `Add citation validator` | Verify cited chunk exists in retrieval results; fabricated/absent citation → reject verdict + audit event. Unit-tested. Commit. |

**Acceptance:** adversarial case downgraded; hallucinated-citation rate zero on test set; verification independently evaluable.

---

## Phase 5 — Evaluation Harness + Baseline

| Microcommit | Content |
|---|---|
| `Add synthetic eval dataset` | 10–15 cases (PRD §11.1): supported + unsupported + ≥1 adversarial + ≥1 ambiguous, across states/districts, ground truth from actual policy text. JSON + deterministic IDs. Commit. |
| `Add direct-LLM baseline runner` | Single-prompt baseline per PRD §8: same model (Gemini), same policy docs, no pipeline. Commit. |
| `Add pipeline eval runner + metrics` | Metrics: verdict accuracy (primary), citation accuracy, hallucinated-clause rate, verification pass rate. Log model/version/config per run (claude.md §6). Commit. |
| `Record baseline vs pipeline results` | Run both, write measured results to `implementation.md` + improvement changelog (PRD §11.4). Only measured numbers (claude.md §7). Commit. |

**Acceptance:** pipeline beats baseline on same fixed cases; numbers published only from real runs.

---

## Phase 6 — Hindi Localization

| Microcommit | Content |
|---|---|
| `Add language detection per turn` | Detect on every turn, never session-level (claude.md §3). Commit. |
| `Add localization agent` | Translate verdict + rationale; terminology table (threshold yield, prevented sowing, cut-off date, notified) enforced exactly; numbers/dates preserved verbatim. Commit. |
| `Add back-translation meaning check` | Back-translate Hindi → English, semantic compare vs original; mismatch → flag, don't ship (claude.md §3). Commit. |
| `Add localization eval cases` | Hindi fidelity check on eval set; meaning-preservation score. Commit. |

**Acceptance:** Hindi output preserves legal meaning; fidelity measured on eval set.

---

## Phase 7 — Grievance Draft + Human Review

| Microcommit | Content |
|---|---|
| `Add grievance draft agent` | Drafts only when verdict ≠ `SUPPORTED`. Plain-language, cites evidence, EN/HI. Commit. |
| `Add mandatory human review gate` | Draft held for explicit human approval; no auto-submit, no external action ever (claude.md §2). Audit event logged. Commit. |
| `Add review-gate tests` | `SUPPORTED` → no draft; unapproved draft never leaves system. Commit. |

**Acceptance:** human checkpoint explicit in flow and tested.

---

## Phase 8 — LangGraph Orchestration + Follow-ups

| Microcommit | Content |
|---|---|
| `Wire pipeline as LangGraph state machine` | States: new case → scope check → extraction → retrieval → reasoning → verification → localization → draft → human review. Explicit routing/retries, not prompt-buried flow (claude.md §2). Commit. |
| `Add scope-check + guardrail node` | Out-of-scope → polite decline; borderline → clarifying question. Guardrail tests: agronomy, other schemes, outcome-guarantee requests. Commit. |
| `Add follow-up Q&A in case context` | Follow-ups grounded in persisted case state; language re-detected per turn. Commit. |
| `Add follow-up + guardrail eval set` | 3–5 in-scope follow-ups, 3–5 out-of-scope probes, ≥1 ambiguous-scope → clarification (PRD §11.2). Commit. |

**Acceptance:** full flow through graph; guardrail precision + follow-up retention measured.

---

## Phase 9 — Frontend (evidence-first neo-brutalism)

| Microcommit | Content |
|---|---|
| `Add case input screen` | Text input + photo upload; OCR text shown in monospace for sanity check with confirm/edit (claude.md §8 OCR rule). Commit. |
| `Add audit result view` | Verdict badge (flat, hard-bordered, role colors only), rationale, source excerpts side-by-side with claims, missing-facts panel. Never bare verdict (claude.md §8). Commit. |
| `Add grievance draft + review UI` | Draft view, approve gate, explicit "human review required" state. Commit. |
| `Add follow-up chat` | Case-context Q&A, per-turn language. Commit. |
| `Add frontend e2e validation` | Playwright MCP if available (record deviation in `implementation.md` if not). Commit. |

**Acceptance:** adversarial demo case runs end-to-end in browser; verification catching bad conclusion visible in UI.

---

## Phase 10 — Docs, Polish, Demo

| Microcommit | Content |
|---|---|
| `Sync README, architecture, implementation docs` | README runnable-from-clean check; `architecture.md` matches reality (claude.md §4). Commit. |
| `Final eval run + results table` | All 7 PRD §11.3 metrics, baseline vs pipeline, measured only. Commit. |
| `Prepare adversarial demo` | One case where verification catches unsupported conclusion (claude.md §7). Commit. |

---

## Verification (end-to-end)

1. `pytest` green — schemas, retrieval, citation validation, guardrails, verification downgrade, review gate.
2. Eval run: pipeline vs baseline on same 10–15 cases; verdict accuracy, citation accuracy, hallucination rate all improved.
3. Browser run (Playwright): typed case → audit → verdict + citations → Hindi toggle → grievance draft → human approval. Photo path via OCR sanity-check.
4. Adversarial demo: verification catches unsupported reasoning, verdict downgrades to `INSUFFICIENT_EVIDENCE` with exposed gaps.

## Key rules threaded through every phase

- Fail closed; expose gaps, never guess.
- No fabricated section numbers — citation validator hard-blocks.
- Measured results only; no invented eval numbers.
- Microcommits + `implementation.md` update in step.
- No co-author trailers in commits.
