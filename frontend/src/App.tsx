import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import {
  createCase,
  assessClaim,
  ocrImage,
  type CaseFacts,
} from "./api"

type Screen = "form" | "extracting" | "results"
type InputMode = "form" | "text" | "image"

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

const INCIDENT_CROP_OPTIONS = [
  "Sugarcane",
  "Paddy",
  "Wheat",
  "Maize",
  "Soybean",
  "Other",
]

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

export default function IncidentReport() {
  const [screen, setScreen] = useState<Screen>("form")
  const [inputMode, setInputMode] = useState<InputMode>("form")
  const [formData, setFormData] = useState<IncidentFormData>(initialFormData)
  const [pastedText, setPastedText] = useState("")
  const [errors, setErrors] = useState<Partial<Record<keyof IncidentFormData, string>>>({})
  const [caseId, setCaseId] = useState<string | null>(null)
  const [facts, setFacts] = useState<CaseFacts | null>(null)
  const [audit, setAudit] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const validateForm = (): boolean => {
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
    } else if (
      isNaN(parseFloat(formData.loss_percent)) ||
      parseFloat(formData.loss_percent) < 0 ||
      parseFloat(formData.loss_percent) > 100
    ) {
      newErrors.loss_percent = "Loss percentage must be between 0 and 100"
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

  // Format a JS date input value (YYYY-MM-DD) for display in
  // the verified-text view, e.g. "18 August 2026"
  const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate) return ""
    try {
      const d = new Date(isoDate)
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return isoDate
    }
  }

  const buildNoticeText = (data: IncidentFormData): string => {
    const lines = [
      "Crop Insurance Incident Report",
      "",
      `Farmer Name: ${data.farmer_name}`,
      `Crop: ${data.crop}`,
      `Season: ${data.season}`,
      `District: ${data.district}`,
      `State: ${data.state}`,
      "",
      `Date of Incident: ${formatDateForDisplay(data.incident_date)}`,
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

  const runAssessment = async (noticeText: string, mode: InputMode) => {
    setIsSubmitting(true)
    setScreen("extracting")
    try {
      // createCase → extract_facts, which detects doc_type automatically
      const response = await createCase(noticeText)
      setCaseId(response.case_id)
      setFacts(response.facts)

      const auditResult = await assessClaim(response.case_id, "en")
      setAudit(auditResult.result)
      setEvents(auditResult.audit_events)
      setScreen("results")
    } catch (err) {
      console.error(err)
      alert(
        `Failed to ${mode === "image" ? "OCR + assess" : "assess"} the incident report.\n\n` +
          String(err)
      )
      setScreen("form")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Form-mode submit ────────────────────────────────────────────────────
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    await runAssessment(buildNoticeText(formData), "form")
  }

  // ─── Text-mode submit ────────────────────────────────────────────────────
  const handleTextSubmit = async () => {
    if (pastedText.trim().length < 20) {
      alert("Please paste the full incident report text (at least 20 characters).")
      return
    }
    await runAssessment(pastedText, "text")
  }

  // ─── Image-mode submit ───────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFileName(file.name)
    setIsSubmitting(true)
    setScreen("extracting")
    try {
      // 1. OCR the image → extracted text
      const ocr = await ocrImage(file)
      // 2. Create a case from the extracted text → auto-extracts facts
      const response = await createCase(ocr.extracted_text)
      setCaseId(response.case_id)
      setFacts(response.facts)

      // 3. Run the claim assessment
      const auditResult = await assessClaim(response.case_id, "en")
      setAudit(auditResult.result)
      setEvents(auditResult.audit_events)
      setScreen("results")
    } catch (err) {
      console.error(err)
      alert("Image upload / OCR failed.\n\n" + String(err))
      setScreen("form")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetAll = () => {
    setScreen("form")
    setFormData(initialFormData)
    setPastedText("")
    setUploadedFileName(null)
    setCaseId(null)
    setFacts(null)
    setAudit(null)
    setEvents([])
    setErrors({})
  }

  const getVerdictStyle = (verdict: string) => {
    const base = "inline-block border-2 px-3 py-1 font-mono text-sm font-bold"
    switch (verdict) {
      case "SUPPORTED":
        return `${base} bg-approved text-white border-ink`
      case "NOT_SUPPORTED":
        return `${base} bg-danger text-white border-ink`
      case "INSUFFICIENT_EVIDENCE":
        return `${base} bg-navy text-white border-ink`
      default:
        return `${base} bg-white text-ink border-ink`
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-canvas font-sans text-ink">
      <header className="border-b-2 border-ink bg-white px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy">DavaCheck</h1>
        <p className="text-sm text-ink/70">
          PMFBY claim-rejection auditor — evidence-grounded, fail-closed
        </p>
      </header>

      <div className="mx-auto max-w-4xl p-6">
        <AnimatePresence mode="wait">
          {screen === "form" && (
            <motion.section
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="border-2 border-ink bg-white"
            >
              <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                STEP 1 — INCIDENT REPORT
              </div>

              {/* Tabs */}
              <div className="flex border-b-2 border-ink">
                {(
                  [
                    { key: "form", label: "FILL FORM" },
                    { key: "text", label: "PASTE TEXT" },
                    { key: "image", label: "UPLOAD PHOTO" },
                  ] as { key: InputMode; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setInputMode(tab.key)}
                    className={`flex-1 border-r-2 border-ink px-4 py-2 font-mono text-sm font-bold last:border-r-0 ${
                      inputMode === tab.key
                        ? "bg-ink text-white"
                        : "bg-white text-ink hover:bg-canvas"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <p className="mb-4 text-sm text-ink/70">
                  Report crop damage under PMFBY. Choose how you want to provide
                  the incident details — fill the form, paste a text report, or
                  upload a photo of the paper form.
                </p>

                {/* ─────── Form tab ─────── */}
                {inputMode === "form" && (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Farmer Name *
                          <input
                            type="text"
                            value={formData.farmer_name}
                            onChange={(e) =>
                              handleInputChange("farmer_name", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="Ramesh Kumar"
                          />
                        </label>
                        {errors.farmer_name && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.farmer_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Crop *
                          <select
                            value={formData.crop}
                            onChange={(e) =>
                              handleInputChange("crop", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                          >
                            <option value="">Select crop...</option>
                            {INCIDENT_CROP_OPTIONS.map((crop) => (
                              <option key={crop} value={crop}>
                                {crop}
                              </option>
                            ))}
                          </select>
                        </label>
                        {errors.crop && (
                          <p className="mt-1 text-xs text-danger">{errors.crop}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Season *
                          <input
                            type="text"
                            value={formData.season}
                            onChange={(e) =>
                              handleInputChange("season", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="Kharif 2026"
                          />
                        </label>
                        {errors.season && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.season}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          District *
                          <select
                            value={formData.district}
                            onChange={(e) =>
                              handleInputChange("district", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                          >
                            <option value="">Select district...</option>
                            {KARNATAKA_DISTRICTS.map((district) => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ))}
                          </select>
                        </label>
                        {errors.district && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.district}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Incident Date *
                          <input
                            type="date"
                            value={formData.incident_date}
                            onChange={(e) =>
                              handleInputChange("incident_date", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                          />
                        </label>
                        {errors.incident_date && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.incident_date}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Cause of Loss *
                          <select
                            value={formData.cause_of_loss}
                            onChange={(e) =>
                              handleInputChange("cause_of_loss", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                          >
                            <option value="">Select cause...</option>
                            {INCIDENT_CAUSE_OPTIONS.map((cause) => (
                              <option key={cause} value={cause}>
                                {cause}
                              </option>
                            ))}
                          </select>
                        </label>
                        {errors.cause_of_loss && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.cause_of_loss}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Affected Area (hectares) *
                          <input
                            type="text"
                            value={formData.affected_area}
                            onChange={(e) =>
                              handleInputChange("affected_area", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="2.5"
                          />
                        </label>
                        {errors.affected_area && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.affected_area}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Estimated Crop Loss (%) *
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.loss_percent}
                            onChange={(e) =>
                              handleInputChange("loss_percent", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="40"
                          />
                        </label>
                        {errors.loss_percent && (
                          <p className="mt-1 text-xs text-danger">
                            {errors.loss_percent}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Policy Number
                          <input
                            type="text"
                            value={formData.policy_number || ""}
                            onChange={(e) =>
                              handleInputChange("policy_number", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="PMFBY/123456"
                          />
                        </label>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Application Number
                          <input
                            type="text"
                            value={formData.application_number || ""}
                            onChange={(e) =>
                              handleInputChange(
                                "application_number",
                                e.target.value
                              )
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="CLM/2026/001"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Tehsil
                          <input
                            type="text"
                            value={formData.tehsil || ""}
                            onChange={(e) =>
                              handleInputChange("tehsil", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="Vijayapura Taluk"
                          />
                        </label>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          Village
                          <input
                            type="text"
                            value={formData.village || ""}
                            onChange={(e) =>
                              handleInputChange("village", e.target.value)
                            }
                            className="mt-1 block w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                            placeholder="Kondapura"
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-bold">
                        Additional Description (optional)
                        <textarea
                          value={formData.description || ""}
                          onChange={(e) =>
                            handleInputChange("description", e.target.value)
                          }
                          className="mt-1 block h-24 w-full border-2 border-ink bg-white p-2 font-mono text-sm"
                          placeholder="Describe the damage in your own words..."
                        />
                      </label>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-4">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="border-2 border-ink bg-navy px-6 py-2 font-mono font-bold text-white hover:bg-ink disabled:opacity-50"
                      >
                        {isSubmitting ? "SUBMITTING..." : "SUBMIT INCIDENT REPORT"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(SAMPLE_FORM)}
                        className="border-2 border-ink bg-white px-4 py-2 font-mono text-sm hover:bg-canvas"
                      >
                        LOAD SAMPLE DATA
                      </button>
                    </div>
                  </form>
                )}

                {/* ─────── Text tab ─────── */}
                {inputMode === "text" && (
                  <div className="space-y-4">
                    <label className="mb-1 block text-sm font-bold">
                      Paste your incident report text below
                      <textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        className="mt-1 block h-72 w-full border-2 border-ink bg-white p-3 font-mono text-sm"
                        placeholder="Paste the rejection notice or claim text here..."
                      />
                    </label>
                    <div className="flex flex-wrap gap-4">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleTextSubmit}
                        className="border-2 border-ink bg-navy px-6 py-2 font-mono font-bold text-white hover:bg-ink disabled:opacity-50"
                      >
                        {isSubmitting ? "ASSESSING..." : "ASSESS REPORT"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPastedText(SAMPLE_TEXT)}
                        className="border-2 border-ink bg-white px-4 py-2 font-mono text-sm hover:bg-canvas"
                      >
                        LOAD SAMPLE TEXT
                      </button>
                      <button
                        type="button"
                        onClick={() => setPastedText("")}
                        className="border-2 border-ink bg-white px-4 py-2 font-mono text-sm hover:bg-canvas"
                      >
                        CLEAR
                      </button>
                    </div>
                    <p className="text-xs text-ink/60">
                      The system will extract farmer, crop, season, district, cause of
                      loss, affected area, and loss % automatically using the LLM
                      extraction module.
                    </p>
                  </div>
                )}

                {/* ─────── Image tab ─────── */}
                {inputMode === "image" && (
                  <div className="space-y-4">
                    <label className="block border-2 border-ink bg-canvas p-6 text-center">
                      <span className="block font-mono text-sm font-bold">
                        Upload photo of paper incident report
                      </span>
                      <span className="mt-1 block text-xs text-ink/60">
                        JPG, PNG, or PDF. Multilingual OCR — works with English or
                        Hindi text.
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isSubmitting}
                        className="mt-3 block w-full font-mono text-xs"
                      />
                    </label>
                    {uploadedFileName && (
                      <div className="border-2 border-ink bg-white p-2 font-mono text-xs">
                        UPLOADED: {uploadedFileName}
                      </div>
                    )}
                    <p className="text-xs text-ink/60">
                      The image is sent to the OCR module, then the extracted text
                      is passed to the same extraction + claim assessment pipeline.
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {screen === "extracting" && (
            <motion.section
              key="extracting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-2 border-ink bg-white p-8 text-center"
            >
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-navy border-t-transparent" />
              <h3 className="text-lg font-bold text-navy">
                Assessing incident report...
              </h3>
              <p className="mt-2 text-sm text-ink/70">
                Extracting facts, retrieving policy excerpts, and running the
                claim assessment.
              </p>
            </motion.section>
          )}

          {screen === "results" && audit && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="border-2 border-ink bg-white p-4">
                <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                  EXTRACTED FACTS [UNVERIFIED — CHECK]
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <span className="font-bold">Farmer:</span> {facts?.farmer_name || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">Crop:</span> {facts?.crop || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">Season:</span> {facts?.season || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">District:</span> {facts?.district || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">State:</span> {facts?.state || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">Cause:</span> {facts?.cause_of_loss || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">Incident Date:</span> {facts?.incident_date || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">Affected Area:</span> {facts?.affected_area || "[MISSING]"}
                  </div>
                  <div>
                    <span className="font-bold">Loss:</span> {facts?.loss_percent ?? "[MISSING]"}%
                  </div>
                </div>
                {facts?.missing_fields && facts.missing_fields.length > 0 && (
                  <div className="mt-2 border-2 border-danger p-2 font-mono text-xs text-danger">
                    MISSING FROM REPORT: {facts.missing_fields.join(", ")}
                  </div>
                )}
              </div>

              <div className="border-2 border-ink bg-white p-4">
                <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                  CLAIM ASSESSMENT
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="font-bold">Verdict:</span>
                  <span className={getVerdictStyle(audit.verdict)}>
                    {audit.verdict}
                  </span>
                  <span className="text-sm text-ink/70">
                    Confidence: {audit.confidence_flag}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{audit.explanation}</p>
              </div>

              {audit.material_claims && audit.material_claims.length > 0 && (
                <div className="border-2 border-ink bg-white">
                  <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                    MATERIAL CLAIMS
                  </div>
                  <ul className="divide-y-2 divide-ink/20">
                    {audit.material_claims.map((c: any, i: number) => (
                      <li key={i} className="p-3 text-sm">
                        <p>{c.claim}</p>
                        <p className="mt-1 font-mono text-xs text-teal">
                          EVIDENCE: {c.citation_refs?.join(", ") || "NONE"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {audit.citations && audit.citations.length > 0 && (
                <div className="border-2 border-ink bg-white">
                  <div className="border-b-2 border-ink bg-navy px-4 py-2 font-mono text-sm font-bold text-white">
                    SUPPORTING POLICY EXCERPTS
                  </div>
                  <ul className="divide-y-2 divide-ink/20">
                    {audit.citations.map((c: any, i: number) => (
                      <li key={i} className="p-3 text-xs">
                        <p className="font-mono font-bold text-navy">
                          [{c.chunk_id}] ({c.section})
                        </p>
                        <blockquote className="mt-1 border-l-4 border-agri pl-2 font-mono text-xs">
                          {c.quote.slice(0, 400)}
                          {c.quote.length > 400 ? "…" : ""}
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {audit.missing_facts && audit.missing_facts.length > 0 && (
                <div className="border-2 border-danger bg-white p-3 font-mono text-sm text-danger">
                  ADDITIONAL EVIDENCE NEEDED: {audit.missing_facts.join(", ")}
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={resetAll}
                  className="border-2 border-ink bg-white px-4 py-2 font-mono font-bold hover:bg-canvas"
                >
                  NEW REPORT
                </button>
              </div>

              {events.length > 0 && (
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
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
