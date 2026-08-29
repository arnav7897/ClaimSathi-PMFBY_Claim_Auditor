# Architecture

Current architecture (matches implementation as of Phase 10).

```
User (farmer / facilitator)
   │  photo or typed notice
   ▼
Frontend (Vite + React + TS + Tailwind, evidence-first UI)
   │
   ▼
FastAPI (backend/davacheck/app.py)
   │
   ├── POST /case/ocr ──────► Multimodal OCR (Gemini vision) ── raw text, unverified
   ├── POST /case ──────────► Extraction agent ──► CaseFacts (Pydantic-validated)
   ├── POST /audit ─────────► LangGraph state machine (graph.py):
   │                            intake → retrieval → reasoning → verification
   │                            → localization → grievance
   ├── POST /grievance/approve ► human approval gate (explicit, audited)
   └── POST /case/followup ─► scope guard → follow-up answer (case-context only)
```

## Retrieval layer

- Corpus: `backend/data/policy/raw/operational_guidelines_2023.txt` (PMFBY
  Operational Guidelines 2023, official PDF, 213 pages), ingested by
  `scripts/ingest_policy.py` into 345 section-aware chunks with deterministic
  IDs (`pmfby-og-2023#s{section}#{n}`), stored in `data/policy/chunks.jsonl`.
- Index: BM25 (`rank-bm25`), pure code, no embeddings. `davacheck/retrieval/__init__.py`.

## Agents (all Gemini via `davacheck/llm.py`, structured output validated by Pydantic)

| Agent | File | Input → Output |
|---|---|---|
| Extraction | `agents/extraction.py` | notice text → `CaseFacts` |
| Reasoning | `agents/reasoning.py` | facts + evidence → `DraftVerdict` (citation-guarded) |
| Verification | `agents/verification.py` | claims + evidence → pass/revise/reject, deterministic downgrade |
| Localization | `agents/localization.py` | EN → HI with terminology table + back-translation check |
| Grievance | `agents/grievance.py` | audit result → draft (never for SUPPORTED; approval-gated) |
| Scope | `agents/scope.py` | user turn → in_scope / out_of_scope / clarify |

## Hard guarantees (code, not prompts)

1. `enforce_citation_guard` (reasoning.py): SUPPORTED with unbacked claims ⇒
   `INSUFFICIENT_EVIDENCE`.
2. `apply_verification` (verification.py): rejected claims / conflicting evidence ⇒
   downgrade; revised claims keep citation refs.
3. `finalize_audit` (citations.py): fabricated chunk refs blocked; SUPPORTED with
   zero valid citations impossible.

## Data & state

- Case state: in-memory (`store.py`) — minimum for follow-up context.
- Audit events: structured `AuditEvent` list returned with every audit.
- Secrets: `.env` only; `.env.example` checked in.

## Evaluation

`backend/eval/run_eval.py` runs the direct-LLM baseline (same model, same docs,
no pipeline) and the full pipeline on the same 12-case fixed dataset
(`eval/dataset.json`: 4 SUPPORTED / 4 NOT_SUPPORTED / 4 INSUFFICIENT_EVIDENCE,
including 2 adversarial cases). Results written to timestamped JSON; measured
numbers only.
