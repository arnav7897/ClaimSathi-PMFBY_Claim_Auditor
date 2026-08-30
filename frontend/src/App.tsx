import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Joyride, { CallBackProps, STATUS } from "react-joyride";
import { UploadCloud, FileText, AlertCircle, CheckCircle2, ChevronRight, MessageSquare, Send, Languages, FileCheck, ShieldAlert, Loader2 } from "lucide-react";
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
type AppState = "splash" | "language" | "main";

const VERDICT_STYLE: Record<string, string> = {
  SUPPORTED: "bg-danger text-white border-danger",
  NOT_SUPPORTED: "bg-approved text-white border-approved",
  INSUFFICIENT_EVIDENCE: "bg-canvas text-ink border-ink",
};

const TOUR_STEPS = [
  {
    target: ".tour-header",
    content: "Welcome to DavaCheck! This tool audits PMFBY claim rejections for validity.",
    disableBeacon: true,
  },
  {
    target: ".tour-lang",
    content: "You can change your preferred language here at any time.",
  },
  {
    target: ".tour-upload",
    content: "Start by uploading a photo of your rejection notice, or paste the text directly.",
  },
  {
    target: ".tour-submit",
    content: "Click here to extract facts and begin the audit process.",
  }
];

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono border-2 shadow-sm ${className}`}>
      {label}
    </span>
  );
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("splash");
  const [runTour, setRunTour] = useState(false);
  const [language, setLanguage] = useState("en");

  const [screen, setScreen] = useState<Screen>("input");
  const [noticeText, setNoticeText] = useState("");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [facts, setFacts] = useState<CaseFacts | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [events, setEvents] = useState<{ stage: string; detail: string }[]>([]);
  const [grievance, setGrievance] = useState<GrievanceDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQ, setFollowUpQ] = useState("");
  const [followUpA, setFollowUpA] = useState<string | null>(null);

  useEffect(() => {
    if (appState === "splash") {
      const timer = setTimeout(() => setAppState("language"), 2500);
      return () => clearTimeout(timer);
    }
  }, [appState]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as string)) {
      setRunTour(false);
    }
  };

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

  // --- RENDERS ---

  if (appState === "splash") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center"
        >
          <ShieldAlert className="w-20 h-20 mx-auto mb-6 text-teal" />
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 font-sans">DavaCheck</h1>
          <p className="text-xl text-canvas/80 font-medium font-sans">PMFBY Claim Auditor</p>
          <div className="mt-8 w-12 h-1 bg-teal mx-auto rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-white"
               initial={{ x: "-100%" }}
               animate={{ x: "100%" }}
               transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
             />
          </div>
        </motion.div>
      </div>
    );
  }

  if (appState === "language") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-2xl shadow-xl border-2 border-ink max-w-md w-full text-center"
        >
          <Languages className="w-16 h-16 mx-auto text-navy mb-6" />
          <h2 className="text-2xl font-bold text-ink mb-2">Select Your Language</h2>
          <p className="text-ink/60 mb-8 font-sans">Choose the language for your audit report.</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => { setLanguage("en"); setAppState("main"); setRunTour(true); }}
              className="w-full py-3 px-6 rounded-xl border-2 border-ink text-ink font-bold hover:bg-navy hover:text-white transition-all font-sans"
            >
              English
            </button>
            <button 
              onClick={() => { setLanguage("hi"); setAppState("main"); setRunTour(true); }}
              className="w-full py-3 px-6 rounded-xl border-2 border-ink text-ink font-bold hover:bg-navy hover:text-white transition-all font-sans"
            >
              हिन्दी (Hindi)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.main 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="min-h-screen bg-canvas font-sans text-ink flex flex-col"
    >
      <Joyride
        steps={TOUR_STEPS}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        callback={handleJoyrideCallback}
        styles={{
          options: { primaryColor: '#0B3C5D', textColor: '#111827', zIndex: 1000 },
        }}
      />

      <header className="tour-header sticky top-0 z-50 border-b-2 border-ink bg-white/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-navy" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-navy">DavaCheck</h1>
            <p className="text-xs text-ink/60 font-medium">Evidence-Grounded Auditor</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setRunTour(true)} className="text-sm font-bold text-navy hover:text-teal underline underline-offset-4">
            Product Tour
          </button>
          <div className="tour-lang flex items-center gap-2 border-2 border-ink rounded-lg px-3 py-1.5 bg-canvas">
            <Languages className="w-4 h-4 text-ink" />
            <select
              className="bg-transparent text-sm font-bold outline-none cursor-pointer"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-4 py-4 mb-4">
          {["Input", "Confirm", "Result"].map((step, idx) => {
            const stepName = step.toLowerCase() as Screen;
            const isActive = screen === stepName;
            const isPast = ["input", "confirm", "result"].indexOf(screen) > idx;
            return (
              <div key={step} className="flex items-center gap-4">
                <div className={`flex items-center gap-2 font-bold text-sm ${isActive ? "text-navy" : isPast ? "text-teal" : "text-ink/30"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 ${isActive ? "border-navy bg-navy text-white" : isPast ? "border-teal bg-teal text-white" : "border-ink/30"}`}>
                    {idx + 1}
                  </span>
                  {step}
                </div>
                {idx < 2 && <ChevronRight className={`w-4 h-4 ${isPast ? "text-teal" : "text-ink/20"}`} />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-2 border-danger bg-danger/10 p-4 rounded-xl flex gap-3 text-danger font-mono text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {screen === "input" && (
            <motion.section key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="border-2 border-ink bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-navy px-6 py-4 border-b-2 border-ink flex items-center gap-2">
                <FileText className="w-5 h-5 text-white" />
                <h2 className="font-bold text-white text-lg tracking-wide">Step 1: Rejection Notice</h2>
              </div>
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="tour-upload space-y-4">
                    <h3 className="font-bold text-ink flex items-center gap-2"><UploadCloud className="w-5 h-5 text-teal" /> Upload Document</h3>
                    <p className="text-sm text-ink/70">Upload a clear photo or PDF of the PMFBY rejection notice received by the farmer.</p>
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-ink/30 rounded-xl bg-canvas cursor-pointer hover:bg-ink/5 hover:border-ink transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-10 h-10 text-ink/50 mb-3" />
                        <p className="mb-2 text-sm text-ink font-semibold">Click to upload or drag and drop</p>
                        <p className="text-xs text-ink/50">PNG, JPG, PDF up to 10MB</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])} />
                    </label>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-ink flex items-center gap-2"><FileText className="w-5 h-5 text-teal" /> Or Paste Text</h3>
                    <textarea
                      aria-label="Rejection notice text"
                      className="w-full h-40 border-2 border-ink rounded-xl bg-canvas p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent transition-all resize-none"
                      placeholder="Paste the raw text of the rejection notice here..."
                      value={noticeText}
                      onChange={(e) => setNoticeText(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button
                    className="tour-submit flex items-center gap-2 bg-navy border-2 border-navy text-white px-8 py-3 rounded-xl font-bold hover:bg-white hover:text-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    disabled={busy || noticeText.trim().length < 20}
                    onClick={handleSubmit}
                  >
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {busy ? "Extracting..." : "Process Notice"}
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {screen === "confirm" && facts && (
            <motion.section key="confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="border-2 border-ink bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-navy px-6 py-4 border-b-2 border-ink flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-white" />
                <h2 className="font-bold text-white text-lg tracking-wide">Step 2: Verify Extracted Facts</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-0">
                <div className="p-6 border-r-2 border-ink bg-canvas/30">
                  <h3 className="mb-4 font-bold text-navy flex items-center gap-2"><FileText className="w-4 h-4" /> Extracted Information</h3>
                  <div className="space-y-3">
                    {[
                      ["Crop", facts.crop],
                      ["Season", facts.season],
                      ["District", facts.district],
                      ["State", facts.state],
                      ["Category", facts.category],
                      ["Rejection Reason", facts.rejection_reason],
                    ].map(([k, v], i) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={k} className="flex justify-between items-center border-b border-ink/10 pb-2">
                        <span className="font-medium text-ink/70 text-sm">{k}</span>
                        <span className={`font-mono text-sm font-semibold ${v ? 'text-ink' : 'text-danger'}`}>{v ?? "MISSING"}</span>
                      </motion.div>
                    ))}
                  </div>
                  {facts.missing_fields.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 border-2 border-danger bg-danger/5 rounded-xl p-4 flex gap-3 items-start text-danger">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm mb-1">Missing Crucial Fields</p>
                        <p className="text-xs font-mono">{facts.missing_fields.join(", ")}</p>
                        <p className="text-xs mt-2 opacity-80">Audit capabilities may be severely limited.</p>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div className="p-6 bg-white">
                   <h3 className="mb-4 font-bold text-navy flex items-center gap-2">Original Text</h3>
                   <div className="relative">
                     <textarea
                        aria-label="Correct notice text"
                        className="w-full h-64 border-2 border-ink rounded-xl bg-canvas p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-navy transition-all resize-none"
                        value={noticeText}
                        onChange={(e) => setNoticeText(e.target.value)}
                      />
                      <div className="absolute top-2 right-2 bg-danger text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Unverified</div>
                   </div>
                </div>
              </div>
              <div className="border-t-2 border-ink bg-canvas px-6 py-4 flex justify-between items-center">
                <p className="text-sm text-ink/60 font-medium flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Ready to run PMFBY policy audit</p>
                <button
                  className="flex items-center gap-2 bg-agri border-2 border-agri text-white px-8 py-3 rounded-xl font-bold hover:bg-white hover:text-agri transition-colors disabled:opacity-50 shadow-md"
                  disabled={busy}
                  onClick={handleAudit}
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
                  {busy ? "Auditing..." : "Run Audit"}
                </button>
              </div>
            </motion.section>
          )}

          {screen === "result" && audit && (
            <motion.section key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              
              {/* Verdict Card */}
              <div className="border-2 border-ink bg-white rounded-2xl p-8 shadow-sm relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-2 h-full ${audit.verdict === 'SUPPORTED' ? 'bg-danger' : audit.verdict === 'NOT_SUPPORTED' ? 'bg-approved' : 'bg-ink/30'}`} />
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <Badge label={audit.verdict} className={VERDICT_STYLE[audit.verdict]} />
                  <Badge label={audit.confidence_flag} className="bg-canvas text-ink border-ink border-dashed" />
                </div>
                <p className="text-lg leading-relaxed text-ink/90 font-medium">{audit.explanation}</p>
              </div>

              {audit.missing_facts.length > 0 && (
                <div className="border-2 border-danger bg-white p-4 rounded-xl flex gap-3 text-danger font-bold text-sm shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>MISSING FACTS IMPEDING FULL AUDIT: <span className="font-mono font-normal ml-2">{audit.missing_facts.join(", ")}</span></p>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Material Claims */}
                <div className="border-2 border-ink bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col">
                  <div className="border-b-2 border-ink bg-canvas px-5 py-3 font-bold text-navy flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal" /> Material Claims Evaluated
                  </div>
                  <ul className="divide-y-2 divide-ink/10 flex-1 bg-white">
                    {audit.material_claims.map((c, i) => (
                      <li key={i} className="p-5">
                        <p className="text-sm font-medium mb-3">{c.claim}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase text-ink/40 bg-ink/5 px-2 py-1 rounded">Citations</span>
                          <span className="font-mono text-xs text-teal font-bold">{c.citation_refs.join(", ") || "NONE"}</span>
                        </div>
                      </li>
                    ))}
                    {audit.material_claims.length === 0 && (
                      <li className="p-8 text-center text-ink/40 text-sm font-medium">No material claims extracted.</li>
                    )}
                  </ul>
                </div>

                {/* Evidence */}
                <div className="border-2 border-ink bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col">
                  <div className="border-b-2 border-ink bg-canvas px-5 py-3 font-bold text-navy flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal" /> Policy Evidence Snippets
                  </div>
                  <ul className="divide-y-2 divide-ink/10 flex-1 bg-white max-h-[400px] overflow-y-auto">
                    {audit.citations.map((c) => (
                      <li key={c.chunk_id} className="p-5">
                        <p className="font-mono text-xs font-bold text-navy mb-2 flex items-center justify-between">
                          <span>{c.chunk_id}</span>
                          <span className="bg-canvas border border-ink/20 px-2 py-0.5 rounded text-[10px]">{c.section}</span>
                        </p>
                        <blockquote className="border-l-4 border-agri pl-3 py-1 font-mono text-xs text-ink/80 bg-agri/5 rounded-r">
                          {c.quote.slice(0, 300)}{c.quote.length > 300 ? "..." : ""}
                        </blockquote>
                      </li>
                    ))}
                    {audit.citations.length === 0 && (
                      <li className="p-8 text-center text-danger text-sm font-medium flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6 opacity-50" />
                        No citations found. Verdict is not evidence-backed.
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Grievance Draft */}
              {grievance && (
                <div className="border-2 border-ink bg-white rounded-2xl overflow-hidden shadow-sm mt-6">
                  <div className="flex flex-wrap items-center justify-between border-b-2 border-ink bg-navy px-6 py-4">
                    <span className="font-bold text-white text-lg flex items-center gap-2"><FileText className="w-5 h-5"/> Generated Grievance Draft</span>
                    <Badge
                      label={grievance.approved ? "APPROVED & READY" : "HUMAN REVIEW REQUIRED"}
                      className={grievance.approved ? "bg-approved text-white border-approved" : "bg-danger text-white border-danger animate-pulse"}
                    />
                  </div>
                  <div className="p-6">
                    <p className="font-bold text-ink mb-4 border-b border-ink/10 pb-2">Subj: {grievance.subject}</p>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-ink/90 leading-relaxed bg-canvas p-6 rounded-xl border border-ink/10">{grievance.body}</pre>
                    {!grievance.approved && (
                      <div className="mt-6 flex justify-end">
                        <button
                          className="bg-approved text-white px-6 py-3 rounded-xl font-bold border-2 border-approved hover:bg-white hover:text-approved transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
                          disabled={busy}
                          onClick={handleApprove}
                        >
                          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                          Approve Draft (Human Reviewed)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Follow-up chat */}
              <div className="border-2 border-ink bg-white rounded-2xl overflow-hidden shadow-sm mt-6">
                <div className="border-b-2 border-ink bg-canvas px-6 py-4 font-bold text-navy flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal" /> Case Follow-up Assistant
                </div>
                <div className="p-6">
                  <div className="flex gap-3 relative">
                    <input
                      aria-label="Follow-up question"
                      className="flex-1 border-2 border-ink rounded-xl px-4 py-3 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                      value={followUpQ}
                      onChange={(e) => setFollowUpQ(e.target.value)}
                      placeholder="Ask about policy limits, next steps, or specific clauses..."
                    />
                    <button
                      className="bg-teal text-white px-6 py-3 rounded-xl font-bold border-2 border-teal hover:bg-white hover:text-teal transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      disabled={busy || !followUpQ.trim()}
                      onClick={handleFollowUp}
                    >
                       {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ask"}
                    </button>
                  </div>
                  {followUpA && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 border-2 border-ink/20 bg-canvas rounded-xl p-5 relative">
                      <div className="absolute -top-3 left-6 bg-teal text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">AI RESPONSE</div>
                      <p className="text-sm text-ink/90 leading-relaxed font-medium">{followUpA}</p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Event Logs */}
              <details className="mt-8 border-2 border-ink bg-white rounded-xl shadow-sm group">
                <summary className="cursor-pointer font-bold text-sm px-6 py-4 flex items-center justify-between hover:bg-canvas transition-colors">
                  <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-ink/50" /> System Audit Trail ({events.length} events)</span>
                </summary>
                <div className="border-t-2 border-ink p-4 bg-canvas/30 max-h-60 overflow-y-auto">
                  <ul className="font-mono text-xs space-y-2">
                    {events.map((e, i) => (
                      <li key={i} className="flex gap-3 text-ink/80 border-b border-ink/5 pb-2">
                        <span className="font-bold text-navy whitespace-nowrap bg-white px-2 py-0.5 rounded border border-ink/10 shadow-sm">[{e.stage}]</span> 
                        <span className="pt-0.5 leading-relaxed">{e.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>

            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.main>
  );
}
