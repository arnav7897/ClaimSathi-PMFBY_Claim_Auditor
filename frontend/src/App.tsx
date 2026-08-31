import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Languages,
  LoaderCircle,
  MessageSquareMore,
  PanelLeft,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import {
  assessClaim,
  createCase,
  followUp,
  ocrImage,
  type AuditResult,
  type CaseFacts,
} from "./api"

type Screen = "form" | "extracting" | "results"
type InputMode = "form" | "text" | "image"
type Language = "en" | "hi"

type IncidentFormData = {
  farmer_name: string
  crop: string
  season: string
  district: string
  state: string
  incident_date: string
  cause_of_loss: string
  affected_area: string
  loss_percent: string
  policy_number?: string
  application_number?: string
  tehsil?: string
  village?: string
  description?: string
}

type FollowUpResult = {
  decision: string
  reason: string
  answer: string | null
}

const INCIDENT_CROP_OPTIONS = ["Sugarcane", "Paddy", "Wheat", "Maize", "Soybean", "Other"]

const INCIDENT_CAUSE_OPTIONS = [
  "Heavy rainfall",
  "Waterlogging",
  "Flood",
  "Drought",
  "Hailstorm",
  "Cyclone",
  "Disease outbreak",
  "Pest attack",
  "Unseasonal rains",
  "Other",
]

const KARNATAKA_DISTRICTS = [
  "Vijayapura",
  "Bagalkot",
  "Belagavi",
  "Bengaluru Urban",
  "Bengaluru Rural",
  "Bidar",
  "Chikkaballapura",
  "Chitradurga",
  "Davanagere",
  "Dharwad",
  "Gadag",
  "Haveri",
  "Hassan",
  "Kodagu",
  "Koppal",
  "Kolar",
  "Kundapura",
  "Mandya",
  "Mysuru",
  "Raichur",
  "Ramanagara",
  "Shivamogga",
  "Tumakuru",
  "Udupi",
  "Uttara Kannada",
  "Yadgir",
]

const SAMPLE_TEXT = `Crop Insurance Incident Report

Farmer Name: Ramesh Kumar
Crop: Sugarcane
Season: Kharif 2026
District: Vijayapura
State: Karnataka

Incident: Heavy rainfall caused waterlogging in the insured sugarcane field.

Date of Incident: 18 August 2026

Affected Area: 2.5 hectares

Estimated Crop Loss: 40%

The farmer reported crop damage due to prolonged waterlogging following heavy rainfall. The affected sugarcane crop showed significant damage and reduced expected yield.

Claim Type: Yield Shortfall

The farmer requests assessment of the crop loss and settlement of the eligible insurance claim under PMFBY.`

const SAMPLE_FORM: IncidentFormData = {
  farmer_name: "Ramesh Kumar",
  crop: "Sugarcane",
  season: "Kharif 2026",
  district: "Vijayapura",
  state: "Karnataka",
  incident_date: "2026-08-18",
  cause_of_loss: "Waterlogging",
  affected_area: "2.5",
  loss_percent: "40",
}

const initialFormData: IncidentFormData = {
  farmer_name: "",
  crop: "",
  season: "",
  district: "",
  state: "Karnataka",
  incident_date: "",
  cause_of_loss: "",
  affected_area: "",
  loss_percent: "",
}

const INPUT_MODES: Array<{ key: InputMode; label: string; detail: string }> = [
  {
    key: "form",
    label: "Structured intake",
    detail: "Enter the essentials in a clean, guided form.",
  },
  {
    key: "text",
    label: "Paste notice text",
    detail: "Drop in the full rejection note or claim summary.",
  },
  {
    key: "image",
    label: "Upload a photo",
    detail: "OCR the notice and send it through the same review flow.",
  },
]

const LANGUAGE_OPTIONS: Array<{ key: Language; label: string; helper: string }> = [
  {
    key: "en",
    label: "English",
    helper: "Assessments, citations, and follow-up replies stay in English.",
  },
  {
    key: "hi",
    label: "Hindi",
    helper: "Assessments, citations, and follow-up replies are returned in Hindi.",
  },
]

const WORKFLOW_STEPS = [
  {
    id: "form",
    label: "Intake",
    detail: "Collect the claim notice in form, text, or image form.",
  },
  {
    id: "extracting",
    label: "Analysis",
    detail: "Extract facts, verify evidence, and produce the claim view.",
  },
  {
    id: "results",
    label: "Review",
    detail: "Switch languages, ask follow-up questions, and inspect citations.",
  },
]

const QUICK_QUESTIONS: Record<Language, string[]> = {
  en: [
    "Which policy clause supports this decision?",
    "What is the strongest evidence in this case?",
    "Summarize the claim in two sentences.",
  ],
  hi: [
    "इस निर्णय को कौन सा प्रावधान समर्थन देता है?",
    "इस मामले का सबसे मजबूत साक्ष्य क्या है?",
    "दावे का सार दो वाक्यों में बताइए।",
  ],
}

const panelClass =
  "rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
const softPanelClass = "rounded-[22px] border border-slate-200 bg-[#fbfaf7]"

function formatDate(value: string | null | undefined) {
  if (!value) return "Not extracted"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function verdictMeta(verdict: string) {
  switch (verdict) {
    case "SUPPORTED":
      return {
        label: "Supported",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
        icon: CheckCircle2,
      }
    case "NOT_SUPPORTED":
      return {
        label: "Not supported",
        tone: "border-rose-200 bg-rose-50 text-rose-800",
        icon: ShieldCheck,
      }
    case "INSUFFICIENT_EVIDENCE":
      return {
        label: "Needs more evidence",
        tone: "border-amber-200 bg-amber-50 text-amber-900",
        icon: Clock3,
      }
    default:
      return {
        label: verdict,
        tone: "border-slate-200 bg-slate-50 text-slate-700",
        icon: ShieldCheck,
      }
  }
}

function sectionLabel(screen: Screen) {
  if (screen === "form") return "Ready for intake"
  if (screen === "extracting") return "Processing case"
  return "Review workspace"
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon
  label: string
  tone: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function LabeledField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </label>
  )
}

function FieldShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-200">
      {children}
    </div>
  )
}

export default function DavaCheckWorkspace() {
  const [screen, setScreen] = useState<Screen>("form")
  const [inputMode, setInputMode] = useState<InputMode>("form")
  const [analysisLanguage, setAnalysisLanguage] = useState<Language>("en")
  const [formData, setFormData] = useState<IncidentFormData>(initialFormData)
  const [pastedText, setPastedText] = useState("")
  const [errors, setErrors] = useState<Partial<Record<keyof IncidentFormData, string>>>({})
  const [caseId, setCaseId] = useState<string | null>(null)
  const [facts, setFacts] = useState<CaseFacts | null>(null)
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [events, setEvents] = useState<{ stage: string; detail: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [followUpQuestion, setFollowUpQuestion] = useState("")
  const [followUpResult, setFollowUpResult] = useState<FollowUpResult | null>(null)
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false)

  const validateForm = () => {
    const newErrors: Partial<Record<keyof IncidentFormData, string>> = {}
    if (!formData.farmer_name.trim()) newErrors.farmer_name = "Farmer name is required"
    if (!formData.crop) newErrors.crop = "Crop is required"
    if (!formData.season.trim()) newErrors.season = "Season is required"
    if (!formData.district) newErrors.district = "District is required"
    if (!formData.incident_date.trim()) newErrors.incident_date = "Incident date is required"
    if (!formData.cause_of_loss) newErrors.cause_of_loss = "Cause of loss is required"
    if (!formData.affected_area.trim()) newErrors.affected_area = "Affected area is required"
    if (!formData.loss_percent.trim()) {
      newErrors.loss_percent = "Loss percentage is required"
    } else {
      const parsed = Number.parseFloat(formData.loss_percent)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        newErrors.loss_percent = "Loss percentage must be between 0 and 100"
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof IncidentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const buildNoticeText = (data: IncidentFormData) => {
    const lines = [
      "Crop Insurance Incident Report",
      "",
      `Farmer Name: ${data.farmer_name}`,
      `Crop: ${data.crop}`,
      `Season: ${data.season}`,
      `District: ${data.district}`,
      `State: ${data.state}`,
      "",
      `Date of Incident: ${formatDate(data.incident_date)}`,
      `Cause of Loss: ${data.cause_of_loss}`,
      `Affected Area: ${data.affected_area} hectares`,
      `Estimated Crop Loss: ${data.loss_percent}%`,
    ]

    if (data.policy_number) lines.push("", `Policy Number: ${data.policy_number}`)
    if (data.application_number) lines.push(`Application Number: ${data.application_number}`)
    if (data.tehsil) lines.push(`Tehsil: ${data.tehsil}`)
    if (data.village) lines.push(`Village: ${data.village}`)
    if (data.description) lines.push("", "Description:", data.description)

    return lines.join("\n")
  }

  const resetAll = () => {
    setScreen("form")
    setInputMode("form")
    setFormData(initialFormData)
    setPastedText("")
    setUploadedFileName(null)
    setCaseId(null)
    setFacts(null)
    setAudit(null)
    setEvents([])
    setErrors({})
    setAnalysisLanguage("en")
    setFollowUpQuestion("")
    setFollowUpResult(null)
    setFollowUpError(null)
    setIsFollowUpLoading(false)
  }

  const assessExistingCase = async (id: string, language: Language) => {
    const auditResult = await assessClaim(id, language)
    setAudit(auditResult.result)
    setEvents(auditResult.audit_events)
    setAnalysisLanguage(language)
    setScreen("results")
  }

  const runAssessment = async (noticeText: string) => {
    setIsSubmitting(true)
    setScreen("extracting")
    setFollowUpResult(null)
    setFollowUpError(null)
    try {
      const response = await createCase(noticeText)
      setCaseId(response.case_id)
      setFacts(response.facts)
      await assessExistingCase(response.case_id, analysisLanguage)
    } catch (err) {
      console.error(err)
      alert(`Failed to review the case.\n\n${String(err)}`)
      setScreen("form")
    } finally {
      setIsSubmitting(false)
    }
  }

  const rerunInLanguage = async (language: Language) => {
    if (!caseId) return
    setIsSubmitting(true)
    setScreen("extracting")
    setFollowUpResult(null)
    setFollowUpError(null)
    try {
      await assessExistingCase(caseId, language)
    } catch (err) {
      console.error(err)
      alert(`Failed to switch language.\n\n${String(err)}`)
      setScreen("results")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLanguageChange = (next: Language) => {
    if (next === analysisLanguage) return
    if (screen === "results" && caseId) {
      void rerunInLanguage(next)
      return
    }
    setAnalysisLanguage(next)
  }

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateForm()) return
    await runAssessment(buildNoticeText(formData))
  }

  const handleTextSubmit = async () => {
    if (pastedText.trim().length < 20) {
      alert("Please paste the full incident report text.")
      return
    }
    await runAssessment(pastedText)
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFileName(file.name)
    setIsSubmitting(true)
    setScreen("extracting")
    setFollowUpResult(null)
    setFollowUpError(null)

    try {
      const ocr = await ocrImage(file)
      const response = await createCase(ocr.extracted_text)
      setCaseId(response.case_id)
      setFacts(response.facts)
      await assessExistingCase(response.case_id, analysisLanguage)
    } catch (err) {
      console.error(err)
      alert(`OCR or review failed.\n\n${String(err)}`)
      setScreen("form")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFollowUp = async () => {
    if (!caseId || !followUpQuestion.trim()) {
      setFollowUpError("Ask a question about the current case first.")
      return
    }

    setIsFollowUpLoading(true)
    setFollowUpError(null)

    try {
      const response = await followUp(caseId, followUpQuestion.trim(), analysisLanguage)
      setFollowUpResult(response)
    } catch (err) {
      console.error(err)
      setFollowUpError(String(err))
    } finally {
      setIsFollowUpLoading(false)
    }
  }

  const verdict = audit ? verdictMeta(audit.verdict) : null
  const workflowTone = sectionLabel(screen)
  const languageName = analysisLanguage === "hi" ? "Hindi" : "English"
  const currentQuickQuestions = QUICK_QUESTIONS[analysisLanguage]

  const factRows: Array<{ label: string; value: string }> = [
    { label: "Farmer", value: facts?.farmer_name ?? "Not extracted" },
    { label: "Crop", value: facts?.crop ?? "Not extracted" },
    { label: "Season", value: facts?.season ?? "Not extracted" },
    { label: "District", value: facts?.district ?? "Not extracted" },
    { label: "State", value: facts?.state ?? "Not extracted" },
    { label: "Tehsil", value: facts?.tehsil ?? "Not extracted" },
    { label: "Village", value: facts?.village ?? "Not extracted" },
    { label: "Cause", value: facts?.cause_of_loss ?? "Not extracted" },
    { label: "Date", value: formatDate(facts?.incident_date) },
    {
      label: "Area",
      value: facts?.affected_area ? `${facts.affected_area} hectares` : "Not extracted",
    },
    {
      label: "Loss",
      value: facts?.loss_percent == null ? "Not extracted" : `${facts.loss_percent}%`,
    },
    { label: "Category", value: facts?.category ?? "Not extracted" },
  ]

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:px-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="order-2 flex flex-col gap-6 xl:order-1">
          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  DavaCheck
                </p>
                <h1 className="text-lg font-semibold tracking-tight">Claim workspace</h1>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              A focused PMFBY review desk for intake teams. Structured entry, OCR, bilingual output, and
              case-scoped follow-up in one place.
            </p>

            <div className="mt-5 space-y-3">
              <StatusPill icon={PanelLeft} label={workflowTone} tone="border-slate-200 bg-slate-50 text-slate-700" />
              <StatusPill icon={Languages} label={languageName} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            </div>
          </section>

          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
                Workflow
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {WORKFLOW_STEPS.map((step) => {
                const active = step.id === screen
                const completed =
                  (screen === "extracting" && step.id === "form") ||
                  (screen === "results" && (step.id === "form" || step.id === "extracting"))
                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-4 transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : completed
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-[#fbfaf7]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{step.label}</p>
                      {active ? (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                          Now
                        </span>
                      ) : completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      )}
                    </div>
                    <p className={`mt-2 text-xs leading-5 ${active ? "text-white/75" : "text-slate-600"}`}>
                      {step.detail}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className={`${panelClass} p-5`}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
              What the product does
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                Build a case from form fields, pasted text, or an image upload.
              </li>
              <li className="flex gap-3">
                <Languages className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                Switch between English and Hindi without losing the current case context.
              </li>
              <li className="flex gap-3">
                <MessageSquareMore className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                Ask follow-up questions after review with the same case scope.
              </li>
              <li className="flex gap-3">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                Inspect verdicts, citations, material claims, and audit events in one view.
              </li>
            </ul>
          </section>

          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
                Configuration
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Frontend API calls read from <span className="font-mono text-[13px] text-slate-900">VITE_API_BASE</span>.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              If that variable is not set, the app talks to <span className="font-mono">http://localhost:8000</span>.
            </p>
          </section>
        </aside>

        <main className="order-1 flex min-w-0 flex-col gap-6 xl:order-2">
          <section className={`${panelClass} overflow-hidden`}>
            <div className="border-b border-slate-200 px-6 py-6 sm:px-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#fbfaf7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                    {workflowTone}
                  </div>

                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Minimal claim review, built like a serious SaaS product.
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                    Use the form, paste a notice, or upload a photo. We keep the interface calm, the
                    language switch obvious, and the follow-up loop one click away.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[410px]">
                  <div className={softPanelClass + " p-4"}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Inputs</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">Form, text, OCR</p>
                  </div>
                  <div className={softPanelClass + " p-4"}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Language
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{languageName}</p>
                  </div>
                  <div className={softPanelClass + " p-4"}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Follow-up
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      Available after review
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-7">
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((option) => {
                  const active = analysisLanguage === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleLanguageChange(option.key)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      title={option.helper}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("text")
                    setPastedText(SAMPLE_TEXT)
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4" />
                  Load sample text
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          </section>

          <AnimatePresence mode="wait">
            {screen === "form" && (
              <motion.section
                key="form"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                className={panelClass}
              >
                <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Step 1
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">Create the case</h3>
                    </div>
                    <p className="max-w-xl text-sm leading-6 text-slate-600">
                      Choose the intake mode that matches what you have in hand. The review flow remains the
                      same after submission.
                    </p>
                  </div>
                </div>

                <div className="border-b border-slate-200 px-6 py-4 sm:px-7">
                  <div className="grid gap-3 md:grid-cols-3">
                    {INPUT_MODES.map((mode) => {
                      const active = inputMode === mode.key
                      return (
                        <button
                          key={mode.key}
                          type="button"
                          onClick={() => setInputMode(mode.key)}
                          className={`rounded-[22px] border p-4 text-left transition ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-[#fbfaf7] text-slate-800 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <p className="text-sm font-semibold">{mode.label}</p>
                          <p className={`mt-2 text-xs leading-5 ${active ? "text-white/75" : "text-slate-600"}`}>
                            {mode.detail}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="p-6 sm:p-7">
                  {inputMode === "form" && (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Farmer name *" error={errors.farmer_name}>
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.farmer_name}
                              onChange={(e) => handleInputChange("farmer_name", e.target.value)}
                              placeholder="Ramesh Kumar"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Crop *" error={errors.crop}>
                          <FieldShell>
                            <select
                              value={formData.crop}
                              onChange={(e) => handleInputChange("crop", e.target.value)}
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                            >
                              <option value="">Select crop</option>
                              {INCIDENT_CROP_OPTIONS.map((crop) => (
                                <option key={crop} value={crop}>
                                  {crop}
                                </option>
                              ))}
                            </select>
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Season *" error={errors.season}>
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.season}
                              onChange={(e) => handleInputChange("season", e.target.value)}
                              placeholder="Kharif 2026"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="District *" error={errors.district}>
                          <FieldShell>
                            <select
                              value={formData.district}
                              onChange={(e) => handleInputChange("district", e.target.value)}
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                            >
                              <option value="">Select district</option>
                              {KARNATAKA_DISTRICTS.map((district) => (
                                <option key={district} value={district}>
                                  {district}
                                </option>
                              ))}
                            </select>
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Incident date *" error={errors.incident_date}>
                          <FieldShell>
                            <input
                              type="date"
                              value={formData.incident_date}
                              onChange={(e) => handleInputChange("incident_date", e.target.value)}
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                            />
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Cause of loss *" error={errors.cause_of_loss}>
                          <FieldShell>
                            <select
                              value={formData.cause_of_loss}
                              onChange={(e) => handleInputChange("cause_of_loss", e.target.value)}
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                            >
                              <option value="">Select cause</option>
                              {INCIDENT_CAUSE_OPTIONS.map((cause) => (
                                <option key={cause} value={cause}>
                                  {cause}
                                </option>
                              ))}
                            </select>
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Affected area (hectares) *" error={errors.affected_area}>
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.affected_area}
                              onChange={(e) => handleInputChange("affected_area", e.target.value)}
                              placeholder="2.5"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Estimated crop loss (%) *" error={errors.loss_percent}>
                          <FieldShell>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.loss_percent}
                              onChange={(e) => handleInputChange("loss_percent", e.target.value)}
                              placeholder="40"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Policy number">
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.policy_number || ""}
                              onChange={(e) => handleInputChange("policy_number", e.target.value)}
                              placeholder="PMFBY/123456"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Application number">
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.application_number || ""}
                              onChange={(e) => handleInputChange("application_number", e.target.value)}
                              placeholder="CLM/2026/001"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Tehsil">
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.tehsil || ""}
                              onChange={(e) => handleInputChange("tehsil", e.target.value)}
                              placeholder="Vijayapura Taluk"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>

                        <LabeledField label="Village">
                          <FieldShell>
                            <input
                              type="text"
                              value={formData.village || ""}
                              onChange={(e) => handleInputChange("village", e.target.value)}
                              placeholder="Kondapura"
                              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>
                      </div>

                      <LabeledField label="Additional description">
                        <FieldShell>
                          <textarea
                            value={formData.description || ""}
                            onChange={(e) => handleInputChange("description", e.target.value)}
                            placeholder="Briefly describe the damage, context, or any rejection note details."
                            className="h-32 w-full resize-y border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                          />
                        </FieldShell>
                      </LabeledField>

                      <div className="flex flex-wrap gap-3 pt-1">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <>
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Reviewing
                            </>
                          ) : (
                            <>
                              Run assessment
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(SAMPLE_FORM)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <FileText className="h-4 w-4" />
                          Load sample form
                        </button>
                      </div>
                    </form>
                  )}

                  {inputMode === "text" && (
                    <div className="space-y-4">
                      <LabeledField label="Paste report text">
                        <FieldShell>
                          <textarea
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Paste the rejection notice, claim text, or field note here."
                            className="h-80 w-full resize-y border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-slate-400"
                          />
                        </FieldShell>
                      </LabeledField>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleTextSubmit}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <>
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Reviewing
                            </>
                          ) : (
                            <>
                              Assess text
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPastedText(SAMPLE_TEXT)}
                          className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Load sample text
                        </button>
                        <button
                          type="button"
                          onClick={() => setPastedText("")}
                          className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {inputMode === "image" && (
                    <div className="space-y-4">
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-[#fbfaf7] px-6 py-12 text-center transition hover:border-slate-400 hover:bg-white">
                        <Upload className="h-10 w-10 text-slate-700" />
                        <span className="mt-4 block text-sm font-semibold text-slate-900">
                          Upload a report image
                        </span>
                        <span className="mt-2 block max-w-md text-xs leading-5 text-slate-500">
                          JPG and PNG are supported here. OCR runs first, then the extracted text is reviewed in the same bilingual workflow.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={isSubmitting}
                          className="mt-5 block w-full max-w-sm text-xs text-slate-600"
                        />
                      </label>

                      {uploadedFileName ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Uploaded:</span> {uploadedFileName}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </motion.section>
            )}

            {screen === "extracting" && (
              <motion.section
                key="extracting"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.985 }}
                className={`${panelClass} flex min-h-[420px] flex-col justify-center p-7 sm:p-10`}
              >
                <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#fbfaf7]">
                    <LoaderCircle className="h-8 w-8 animate-spin text-slate-900" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                    Working on the case
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Extracting facts, reviewing evidence, and preparing the output in {languageName}.
                  </p>

                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
                    {["Extracting facts", "Checking evidence", "Formatting response"].map((item, index) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-4 text-left"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Stage {index + 1}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {screen === "results" && audit ? (
              <motion.section
                key="results"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="space-y-6"
              >
                <section className={panelClass}>
                  <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Review result
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-950">Case summary</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {verdict ? (
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${verdict.tone}`}>
                            <verdict.icon className="h-3.5 w-3.5" />
                            {verdict.label}
                          </span>
                        ) : null}
                        <StatusPill
                          icon={Languages}
                          label={`In ${languageName}`}
                          tone="border-slate-200 bg-slate-50 text-slate-700"
                        />
                        {caseId ? (
                          <StatusPill
                            icon={Copy}
                            label={caseId}
                            tone="border-slate-200 bg-white text-slate-700"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                    <div className="space-y-5">
                      <p className="text-sm leading-7 text-slate-700">{audit.explanation}</p>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className={softPanelClass + " p-4"}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Confidence
                          </p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{audit.confidence_flag}</p>
                        </div>
                        <div className={softPanelClass + " p-4"}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Evidence items
                          </p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{audit.citations.length}</p>
                        </div>
                        <div className={softPanelClass + " p-4"}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Missing facts
                          </p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{audit.missing_facts.length}</p>
                        </div>
                      </div>

                      {facts?.missing_fields?.length ? (
                        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                          <span className="font-semibold">Missing from the intake:</span>{" "}
                          {facts.missing_fields.join(", ")}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-[#fbfaf7] p-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-600" />
                        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                          Policy snapshot
                        </h4>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        This view keeps the verdict, the reasoning, and the evidence together so reviewers do
                        not have to hop between screens.
                      </p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-slate-500">Category</span>
                          <span className="font-medium text-slate-900">{facts?.category || "Not extracted"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-slate-500">Incident date</span>
                          <span className="font-medium text-slate-900">{formatDate(facts?.incident_date)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-slate-500">Language</span>
                          <span className="font-medium text-slate-900">{languageName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                  <div className="space-y-6">
                    <section className={panelClass}>
                      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-slate-700" />
                          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                            Extracted facts
                          </h4>
                        </div>
                      </div>
                      <div className="grid gap-3 px-6 py-6 sm:px-7 sm:grid-cols-2 lg:grid-cols-3">
                        {factRows.map((item) => (
                          <div key={item.label} className={softPanelClass + " px-4 py-3"}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {item.label}
                            </p>
                            <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className={panelClass}>
                      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-700" />
                          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                            Evidence and reasoning
                          </h4>
                        </div>
                      </div>
                      <div className="space-y-4 px-6 py-6 sm:px-7">
                        {audit.citations.length ? (
                          <div className="grid gap-3">
                            {audit.citations.map((citation) => (
                              <article key={citation.chunk_id} className="rounded-[22px] border border-slate-200 bg-[#fbfaf7] p-4">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  <span>{citation.doc_id}</span>
                                  <span>•</span>
                                  <span>{citation.section}</span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-700">"{citation.quote}"</p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-slate-600">No citations were returned for this case.</p>
                        )}

                        {audit.material_claims.length ? (
                          <div className="mt-6 space-y-3">
                            {audit.material_claims.map((claim, index) => (
                              <div key={`${claim.claim}-${index}`} className="rounded-[22px] border border-slate-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">{claim.claim}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{claim.reasoning}</p>
                                  </div>
                                  <span className="rounded-full border border-slate-200 bg-[#fbfaf7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {claim.citation_refs.length} refs
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className={panelClass}>
                      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
                        <div className="flex items-center gap-2">
                          <MessageSquareMore className="h-4 w-4 text-slate-700" />
                          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                            Follow-up questions
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-4 px-6 py-6 sm:px-7">
                        <div className="flex flex-wrap gap-2">
                          {currentQuickQuestions.map((question) => (
                            <button
                              key={question}
                              type="button"
                              onClick={() => setFollowUpQuestion(question)}
                              className="rounded-full border border-slate-200 bg-[#fbfaf7] px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            >
                              {question}
                            </button>
                          ))}
                        </div>

                        <LabeledField label="Ask a case-scoped question">
                          <FieldShell>
                            <textarea
                              value={followUpQuestion}
                              onChange={(e) => setFollowUpQuestion(e.target.value)}
                              placeholder="Ask for a clause, a summary, or a deeper explanation."
                              className="h-28 w-full resize-y border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-slate-400"
                            />
                          </FieldShell>
                        </LabeledField>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleFollowUp}
                            disabled={isFollowUpLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isFollowUpLoading ? (
                              <>
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                Asking
                              </>
                            ) : (
                              <>
                                Ask follow-up
                                <Send className="h-4 w-4" />
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFollowUpQuestion("")}
                            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Clear
                          </button>
                        </div>

                        {followUpError ? (
                          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {followUpError}
                          </div>
                        ) : null}

                        {followUpResult ? (
                          <div className="space-y-3 rounded-[22px] border border-slate-200 bg-[#fbfaf7] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Follow-up result
                              </p>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {followUpResult.decision}
                              </span>
                            </div>
                            <p className="text-sm leading-6 text-slate-700">{followUpResult.reason}</p>
                            {followUpResult.answer ? (
                              <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                                {followUpResult.answer}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section className={panelClass}>
                      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-slate-700" />
                          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                            Audit trail
                          </h4>
                        </div>
                      </div>
                      <div className="space-y-3 px-6 py-6 sm:px-7">
                        {events.length ? (
                          events.map((event, index) => (
                            <div key={`${event.stage}-${index}`} className="flex gap-3">
                              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[#fbfaf7] text-[11px] font-semibold text-slate-500">
                                {index + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-950">{event.stage}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{event.detail}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm leading-6 text-slate-600">
                            Audit steps will appear here after a case is processed.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                </section>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </main>

        <aside className="order-3 flex flex-col gap-6 xl:order-3">
          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <PanelLeft className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
                Case snapshot
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Active case
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {caseId || "No case created yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Review language
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">{languageName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Follow-up
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  Available after review, with the same case context
                </p>
              </div>
            </div>
          </section>

          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
                Evidence view
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The output is designed to stay readable: verdict at the top, facts in the middle, evidence
              beneath, and follow-up on the same screen.
            </p>
          </section>

          <section className={`${panelClass} p-5`}>
            <div className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
                Shortcuts
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setInputMode("text")
                  setPastedText(SAMPLE_TEXT)
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-white"
              >
                Load sample notice
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-white"
              >
                Start new case
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
