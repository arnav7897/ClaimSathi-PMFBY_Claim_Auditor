# CLAUDE.md — DavaCheck

DavaCheck is an evidence-grounded PMFBY claim-rejection auditor, not a claim adjudicator or legal-advice system. The primary user is a farmer or facilitator holding a PMFBY claim rejection notice. The core job is to compare the stated rejection reason against applicable policy evidence and expose support, contradiction, or missing evidence.

---

## 1. Product Scope & Verdicts

- Preserve exactly three verdicts: `SUPPORTED`, `NOT_SUPPORTED`, `INSUFFICIENT_EVIDENCE`.
- Never claim a claim is legally valid or invalid — the system audits whether a *rejection reason* is evidence-supported, nothing more.
- Treat official PMFBY documents as source of truth; prefer primary government documents over summaries.
- Never invent section numbers, thresholds, dates, eligibility rules, or citations.
- Every material reasoning claim must retain traceability to retrieved source evidence.
- Fail closed when evidence is missing, contradictory, malformed, or unverifiable — expose missing facts and conflicts, don't hide uncertainty.
- All final user-facing claims must be consistent with the evidence actually available.

## 2. Orchestration & State

- Use LangGraph (or equivalent explicit orchestration) for state, routing, retries, and follow-up context — not implicit control flow buried in prompts.
- Keep retrieval separate from reasoning, and verification separate from generation, so each can be evaluated independently. Verification must be able to reject unsupported reasoning before final output.
- Persist only the minimum case state required for a follow-up conversation.
- Use structured schemas for case facts, evidence, verdicts, citations, uncertainty, and audit events. Validate all model-generated structured output before it reaches downstream nodes.
- Keep human review mandatory for grievance decisions and any consequential action. Never submit a grievance, contact an insurer, or take an external consequential action automatically.

## 3. Multilingual

- Initial supported languages: English and Hindi, unless `implementation.md` explicitly records expanded scope.
- Re-detect the language on every user turn — never assume a session-level language.
- Treat multilingual output as a correctness problem, not a translation feature: preserve terminology and numeric values exactly, and use back-translation (or equivalent semantic check) wherever multilingual verification is implemented.

## 4. Documentation — Source of Truth

Before changing code, **read `implementation.md` and `architecture.md` first.**

- **`implementation.md`** is the single source of truth for project state across sessions. Stay **strictly under 100 lines** — a hard limit; condense or retire old entries rather than just appending. Record what's completed, key edits, current limitations, tests, and the next concrete phase. Update **immediately after every meaningful phase**, not at session end. Append/update, never rewrite wholesale — history should stay understandable.
- **`architecture.md`** must reflect actual current architecture, not an aspirational diagram.
- **`README.md`** must stay runnable and synced with setup, commands, env vars, and current features. Verify its commands from a clean environment before any release/demo.
- If implementation contradicts the PRD, confirm the product decision and update the PRD — don't let them silently drift apart.

## 5. MCP Tool Usage

- **Playwright MCP** — browser inspection, interaction, and end-to-end validation for frontend work, when available.
- **Magic MCP** — frontend/component scaffolding when available, but never accept generated UI blindly: review manually and enforce accessibility, responsive behavior, typing, and component reuse.
- **Context7 MCP** — current backend/library/API documentation, before relying on remembered behavior that may be outdated.
- **Caveman MCP** — repository setup and environment bootstrap tasks, when available.
- If an MCP is unavailable, use the documented fallback and **record the deviation** in `implementation.md`. Never invent MCP commands or capabilities — inspect the tool schema first.

## 6. Engineering Practices

- Prefer small, typed, testable modules over large agent prompts or monolithic files.
- Keep business rules deterministic where practical; use LLMs for interpretation, extraction, and language tasks — not logic that can be plain code.
- Prefer explicit error states over silent fallback behavior. Keep prompts versioned and reviewable, not embedded invisibly in code.
- Use deterministic IDs for cases/evidence where reproducibility benefits. Log model/version and retrieval/eval config needed to reproduce a run.
- Keep dependencies minimal and pin versions where reproducibility requires it.
- Never add a feature solely to increase agent count or complexity — prefer a smaller, reliable workflow over a larger one with decorative agents.

## 7. Testing & Evaluation

- Every feature needs a clear acceptance criterion before implementation.
- Prefer tests for deterministic logic, schemas, retrieval filters, citation validation, and guardrails. Add a regression test whenever an observed failure is fixed.
- Run formatting, type checks, unit tests, and relevant Playwright tests before declaring a phase complete. Never mark a feature complete if acceptance criteria or tests are missing.
- Evaluation must run baseline and final agent on the **same fixed cases** — at least 10, including adversarial and ambiguous ones.
- Track **evidence-grounded decision accuracy** as the primary metric; citation accuracy and unsupported-claim rate as critical safety metrics. Never fabricate results — only publish measured ones.
- Capture representative agent trajectories: retrieval, reasoning, verification, retries, human checkpoints.
- The demo should center on one adversarial rejection case where verification catches an unsupported conclusion.

## 8. Frontend

Keep the UI evidence-first: verdict, rationale, source excerpts, missing facts, and next action must always be visible — never a bare verdict.

**Design direction — Refined Neo-Brutalism for auditors:** no soft dropshadows, gradients, or slow animations; those read as evasive during a high-stakes audit. The UI should look like raw, unedited truth — crisp, bordered, high-contrast, built for scanning many data points quickly.

**Palette (strict roles — never reuse a color outside its role):**

| Role | Hex | Purpose |
|---|---|---|
| Primary Base | `#FFFFFF` / `#F8F9FA` | Off-white canvas; minimizes glare, feels clinical |
| Structural Ink | `#111827` | Charcoal for borders and typography |
| Trust Dominant | `#0B3C5D` | Institutional Navy — legal authority, security |
| Agri Accent | `#008080` / `#2E7D32` | Muted Teal/Forest Green — agriculture, not amateurish |
| Warning/Error | `#D32F2F` | Flat red — strictly "Mismatched Data" / "Rejected" flags |
| Success/Approved | `#1B5E20` | Flat green — strictly "Verified" fields / approvals |

- **Layout:** sharp, flat 1–2px `#111827` borders block off sections; no dropshadows. Multi-source data (Bank/Insurer/Farmer, or Evidence/Verdict/Notice) must stay visually modular and never blend together.
- **Typography:** sans-serif (Inter or Plus Jakarta Sans) for labels/body; **monospace (JetBrains Mono or SF Mono), no exceptions**, for all financial figures, Aadhaar numbers, plot/survey IDs, dates, and raw extracted values — this reinforces the evidence-first principle above by visually marking exact, unaltered source data.
- **Status badges:** flat, color-coded, hard-bordered (e.g., a solid red box: `[72-Hr Window Violated]`) — no pill shapes or gradients. Every verdict and flagged discrepancy renders as one of these, using only the palette roles above. This is a compliance requirement, not a style preference.
- Avoid dark patterns, overconfident confidence scores, or UI implying legal certainty the system doesn't have.
- Accessible labels, keyboard navigation, sufficient contrast, mobile-friendly layouts.
- OCR: show extracted text (monospace) for sanity-checking before reasoning runs; treat it as untrusted input; preserve the original image reference.

## 9. Security & Data

- Use synthetic cases and public documents for development/evaluation — never commit real farmer PII.
- Keep credentials, API keys, tokens, and secrets outside the repository; use environment variables and a checked-in `.env.example`.

## 10. Git Workflow

- Commit in **small, frequent, logically scoped microcommits** — one meaningful change per commit, not end-of-session dumps.
- Plain, descriptive, imperative-mood messages (e.g., `Add verification agent citation check`).
- **Do not add co-author trailers** (e.g., no `Co-Authored-By` lines) to any commit.
- Commit in step with each `implementation.md` update — history and the doc should tell the same story.

## 11. Scope Discipline (48-hour build)

Target scope: core auditing, evidence verification, English/Hindi, evaluation, human-reviewed grievance draft. OCR, follow-up memory, and additional languages are secondary and must never compromise the core audit path. When uncertain about missing evidence, surface the gap — never guess.