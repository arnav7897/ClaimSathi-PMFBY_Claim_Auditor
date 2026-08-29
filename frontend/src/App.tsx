import { useState } from "react";
import {
  approveGrievance,
  createCase,
  followUp,
  ocrImage,
  runAudit,
  type AuditResult,
  type CaseFacts,
  type GrievanceDraft,
} from "./api";

type Screen = "input" | "confirm" | "result";

const VERDICT_STYLE: Record<string, string> = {
  SUPPORTED: "bg-danger text-white border-ink",
  NOT_SUPPORTED: "bg-approved text-white border-ink",
  INSUFFICIENT_EVIDENCE: "bg-white text-ink border-ink",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block border-2 px-3 py-1 font-mono text-sm font-bold ${className}`}>
      [{label}]
    </span>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>("input");
  const [noticeText, setNoticeText] = useState("");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [facts, setFacts] = useState<CaseFacts | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [events, setEvents] = useState<{ stage: string; detail: string }[]>([]);
  const [grievance, setGrievance] = useState<GrievanceDraft | null>(null);
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQ, setFollowUpQ] = useState("");
  const [followUpA, setFollowUpA] = useState<string | null>(null);

  async function handleOcr(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ocr = await ocrImage(file);
      setNoticeText(ocr.extracted_text);
      setScreen("confirm");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { case_id, facts } = await createCase(noticeText);
      setCaseId(case_id);
      setFacts(facts);
      setScreen("confirm");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAudit() {
    if (!caseId) return;
    setBusy(true);
    setError(null);
    try {
      const out = await runAudit(caseId, language);
      setAudit(out.result);
      setEvents(out.audit_events);
      setGrievance(out.grievance_draft);
      setScreen("result");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!caseId) return;
    setBusy(true);
    try {
      const out = await approveGrievance(caseId);
      setGrievance(out.grievance_draft);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleFollowUp() {
    if (!caseId || !followUpQ.trim()) return;
    setBusy(true);
    try {
      const out = await followUp(caseId, followUpQ);
      setFollowUpA(
        out.decision === "answered" ? out.answer : `[${out.decision.toUpperCase()}] ${out.reason}`
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas font-sans text-ink">
      <header className="border-b-2 border-ink bg-white px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy">DavaCheck</h1>
        <p className="text-sm text-ink/70">
          PMFBY claim-rejection auditor — evidence-grounded, fail-closed
        </p>
      </header>

      {error && (
        <div className="mx-6 mt-4 border-2 border-danger bg-white p-3 font-mono text-sm text-danger">
          {error}
        </div>
      )}

      {screen === "input" && (
        <section className="p-6">
          <div className="border-2 border-ink bg-white">
            <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
              STEP 1 — REJECTION NOTICE
            </div>
            <div className="p-4">
              <label className="mb-2 block border-2 border-ink bg-white px-2 py-1 text-sm font-bold">
                Upload photo of notice
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full font-mono text-xs"
                  onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])}
                />
              </label>
              <textarea
                aria-label="Rejection notice text"
                className="mt-4 h-48 w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                placeholder="…or paste the rejection notice text here"
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
              />
              <button
                className="mt-3 border-2 border-ink bg-navy px-4 py-2 font-mono font-bold text-white hover:bg-ink disabled:opacity-50"
                disabled={busy || noticeText.trim().length < 20}
                onClick={handleSubmit}
              >
                {busy ? "EXTRACTING…" : "SUBMIT NOTICE"}
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "confirm" && facts && (
        <section className="p-6">
          <div className="border-2 border-ink bg-white">
            <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
              STEP 2 — VERIFY EXTRACTED FACTS
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-mono text-sm font-bold">EXTRACTED FACTS</h3>
                <dl className="font-mono text-sm">
                  {[
                    ["CROP", facts.crop],
                    ["SEASON", facts.season],
                    ["DISTRICT", facts.district],
                    ["STATE", facts.state],
                    ["CATEGORY", facts.category],
                    ["REJECTION REASON", facts.rejection_reason],
                  ].map(([k, v]) => (
                    <div key={k} className="flex border-b border-ink/20 py-1">
                      <dt className="w-44 font-bold">{k}</dt>
                      <dd className={v ? "" : "text-danger"}>{v ?? "[MISSING]"}</dd>
                    </div>
                  ))}
                </dl>
                {facts.missing_fields.length > 0 && (
                  <div className="mt-2 border-2 border-danger p-2 font-mono text-xs text-danger">
                    MISSING: {facts.missing_fields.join(", ")} — audit may be limited
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 font-mono text-sm font-bold">
                  NOTICE TEXT <span className="text-danger">[UNVERIFIED — CHECK]</span>
                </h3>
                <pre className="h-48 overflow-auto border-2 border-ink bg-canvas p-2 font-mono text-xs">
                  {noticeText}
                </pre>
                <textarea
                  aria-label="Correct notice text"
                  className="mt-2 h-16 w-full border-2 border-ink p-2 font-mono text-xs"
                  value={noticeText}
                  onChange={(e) => setNoticeText(e.target.value)}
                />
              </div>
            </div>
            <div className="border-t-2 border-ink p-4">
              <label className="mr-4 font-mono text-sm font-bold">
                OUTPUT LANGUAGE:{" "}
                <select
                  className="border-2 border-ink px-2 py-1 font-mono"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </label>
              <button
                className="border-2 border-ink bg-navy px-4 py-2 font-mono font-bold text-white hover:bg-ink disabled:opacity-50"
                disabled={busy}
                onClick={handleAudit}
              >
                {busy ? "AUDITING…" : "RUN AUDIT"}
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "result" && audit && (
        <section className="space-y-4 p-6">
          <div className="border-2 border-ink bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge label={audit.verdict} className={VERDICT_STYLE[audit.verdict]} />
              <Badge
                label={audit.confidence_flag}
                className="bg-white text-ink border-ink"
              />
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed">{audit.explanation}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border-2 border-ink bg-white">
              <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                MATERIAL CLAIMS
              </div>
              <ul className="divide-y-2 divide-ink/20">
                {audit.material_claims.map((c, i) => (
                  <li key={i} className="p-3 text-sm">
                    <p>{c.claim}</p>
                    <p className="mt-1 font-mono text-xs text-teal">
                      CITES: {c.citation_refs.join(", ") || "NONE"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-2 border-ink bg-white">
              <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                SOURCE EVIDENCE
              </div>
              <ul className="divide-y-2 divide-ink/20">
                {audit.citations.map((c) => (
                  <li key={c.chunk_id} className="p-3">
                    <p className="font-mono text-xs font-bold text-navy">
                      {c.chunk_id} ({c.section})
                    </p>
                    <blockquote className="mt-1 border-l-4 border-agri pl-2 font-mono text-xs">
                      {c.quote.slice(0, 400)}
                      {c.quote.length > 400 ? "…" : ""}
                    </blockquote>
                  </li>
                ))}
                {audit.citations.length === 0 && (
                  <li className="p-3 font-mono text-xs text-danger">
                    NO CITATIONS — verdict not evidence-backed
                  </li>
                )}
              </ul>
            </div>
          </div>

          {audit.missing_facts.length > 0 && (
            <div className="border-2 border-danger bg-white p-3 font-mono text-sm text-danger">
              MISSING FACTS: {audit.missing_facts.join(", ")}
            </div>
          )}

          {grievance && (
            <div className="border-2 border-ink bg-white">
              <div className="flex items-center justify-between border-b-2 border-ink bg-navy px-4 py-2">
                <span className="font-mono text-sm font-bold text-white">GRIEVANCE DRAFT</span>
                <Badge
                  label={grievance.approved ? "APPROVED" : "HUMAN REVIEW REQUIRED"}
                  className={grievance.approved ? "bg-approved text-white border-ink" : "bg-danger text-white border-ink"}
                />
              </div>
              <div className="p-4">
                <p className="font-mono text-sm font-bold">{grievance.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{grievance.body}</pre>
                {!grievance.approved && (
                  <button
                    className="mt-3 border-2 border-ink bg-approved px-4 py-2 font-mono font-bold text-white hover:bg-ink disabled:opacity-50"
                    disabled={busy}
                    onClick={handleApprove}
                  >
                    APPROVE DRAFT (HUMAN REVIEW)
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="border-2 border-ink bg-white">
            <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
              FOLLOW-UP (SAME CASE)
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <input
                  aria-label="Follow-up question"
                  className="flex-1 border-2 border-ink p-2 font-mono text-sm"
                  value={followUpQ}
                  onChange={(e) => setFollowUpQ(e.target.value)}
                  placeholder="Ask about this case… (English or Hindi)"
                />
                <button
                  className="border-2 border-ink bg-navy px-4 font-mono font-bold text-white hover:bg-ink disabled:opacity-50"
                  disabled={busy}
                  onClick={handleFollowUp}
                >
                  ASK
                </button>
              </div>
              {followUpA && (
                <p className="mt-3 border-2 border-ink bg-canvas p-2 text-sm">{followUpA}</p>
              )}
            </div>
          </div>

          <details className="border-2 border-ink bg-white p-3">
            <summary className="cursor-pointer font-mono text-sm font-bold">
              AUDIT TRAIL ({events.length} events)
            </summary>
            <ul className="mt-2 font-mono text-xs">
              {events.map((e, i) => (
                <li key={i} className="border-b border-ink/10 py-1">
                  [{e.stage}] {e.detail}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </main>
  );
}

export default App;
