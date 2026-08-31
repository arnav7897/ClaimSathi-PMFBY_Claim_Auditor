const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type Verdict = "SUPPORTED" | "NOT_SUPPORTED" | "INSUFFICIENT_EVIDENCE";

export interface CaseFacts {
  farmer_name: string | null;
  application_number: string | null;
  policy_number: string | null;
  crop: string | null;
  season: string | null;
  district: string | null;
  state: string | null;
  tehsil: string | null;
  village: string | null;
  incident_date: string | null;
  cause_of_loss: string | null;
  affected_area: string | null;
  loss_percent: number | null;
  rejection_reason: string | null;
  cited_clause: string | null;
  category: string;
  dates: string[];
  missing_fields: string[];
}

export interface Citation {
  chunk_id: string;
  doc_id: string;
  section: string;
  quote: string;
}

export interface MaterialClaim {
  claim: string;
  citation_refs: string[];
  reasoning: string;
}

export interface AuditResult {
  verdict: Verdict;
  explanation: string;
  citations: Citation[];
  material_claims: MaterialClaim[];
  missing_facts: string[];
  confidence_flag: string;
}

export interface GrievanceDraft {
  subject: string;
  body: string;
  language: string;
  approved: boolean;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${path}: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

export async function createCase(noticeText: string): Promise<{ case_id: string; facts: CaseFacts }> {
  return post("/case", { notice_text: noticeText });
}

export async function ocrImage(file: File): Promise<{ extracted_text: string; image_ref: string; verified: boolean }> {
  const form = new FormData();
  form.append("image", file);
  const resp = await fetch(`${BASE}/case/ocr`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(`OCR failed: ${resp.status}`);
  return resp.json();
}

export async function runAudit(caseId: string, language: string): Promise<{
  result: AuditResult;
  audit_events: { stage: string; detail: string }[];
  grievance_draft: GrievanceDraft | null;
}> {
  const resp = await fetch(`${BASE}/audit?case_id=${encodeURIComponent(caseId)}&language=${language}`, {
    method: "POST",
  });
  if (!resp.ok) throw new Error(`/audit: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

/**
 * Assess a claim application / incident report.
 * Returns an assessment result with verdict, citations, and material claims.
 * Used by the incident report frontend.
 */
export async function assessClaim(caseId: string, language: string = "en"): Promise<{
  result: AuditResult;
  audit_events: { stage: string; detail: string }[];
}> {
  const resp = await fetch(
    `${BASE}/claim-assessment?case_id=${encodeURIComponent(caseId)}&language=${language}`,
    { method: "POST" }
  );
  if (!resp.ok) throw new Error(`/claim-assessment: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

export async function approveGrievance(caseId: string): Promise<{ grievance_draft: GrievanceDraft }> {
  return post("/grievance/approve", { case_id: caseId });
}

export async function followUp(caseId: string, turn: string, language: string = "en"): Promise<{
  decision: string;
  reason: string;
  answer: string | null;
}> {
  return post("/case/followup", { case_id: caseId, turn, language });
}
