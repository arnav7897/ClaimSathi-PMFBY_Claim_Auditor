# PRD: PMFBY Claim-Rejection Auditor

## 1. Product Summary

We are building a tool to audit whether a PMFBY claim rejection is actually supported by the scheme's policy and operational rules. The product is intentionally narrow: it answers only whether the stated rejection reason is justified by evidence, not whether a farmer is entitled to a full claim payout in all circumstances.

This is a grounded audit assistant for PMFBY cases. It reads a claim rejection notice, retrieves the relevant scheme clauses, checks whether the rejection is supported by those clauses, and returns a plain-language verdict in a farmer-friendly format.

Key scope decisions:
- Focus only on claim-rejection auditing.
- Do not attempt full claim adjudication or payout calculation.
- Limit the first release to 1–2 claim categories.
- Support only English and Hindi in v1.
- Require an explicit evidence-verification step before finalizing any answer.

---

## 2. Problem Statement

Farmers enrolled in the Pradhan Mantri Fasal Bima Yojana (PMFBY) often face claim rejections, delays, or reduced settlements that are hard to verify. The rejection reason is frequently written in dense policy/legal language, and most farmers do not have the time, legal literacy, or language access to check whether the insurer's stated ground for rejection is actually valid.

The problem is not only paperwork complexity; it is also a trust and evidence gap. In many cases, a farmer receives a rejection letter citing a rule, but cannot easily verify whether the rule truly applies to their crop, season, district, or circumstances.

This issue is especially severe because:
- PMFBY documents and rejection letters often use legal and operational terminology that is not accessible to the average farmer.
- Farmers may be operating in Hindi or another regional language while the policy texts and notices are largely in English.
- Even where the rejection is wrong or ambiguous, the burden of verification is on the farmer, who often lacks access to the policy text and the institutional support to interpret it.

This product targets the audit step, not the full grievance or claims workflow: it helps answer one narrow question: "Is the stated rejection reason supported by the policy evidence?"

---

## 3. Scope and Product Boundaries

### 3.1 In Scope
- Auditing whether a specified rejection reason is supported by the PMFBY policy text.
- Comparing a rejection notice to the relevant scheme clauses.
- Returning a clear verdict: Supported / Not Supported / Ambiguous.
- Showing the relevant evidence and reasoning in plain language.
- Drafting a grievance letter only when the rejection appears unsupported or uncertain.
- Supporting follow-up questions that remain within the same case context.

### 3.2 Explicitly Out of Scope
- Full claim adjudication across all PMFBY scenarios.
- Calculating final claim amount or payment decision.
- Approving or denying claim eligibility beyond the stated rejection reason.
- General legal advice unrelated to PMFBY claim rejection logic.
- Supporting every Indian language in v1.
- Building a universal crop-insurance assistant for all possible claim types.

### 3.3 Initial Claim Types (v1)
We will narrow the first release to 1–2 claim types only, to maximize reliability instead of spreading the system thinly across many claim scenarios.

Recommended v1 claim types:
- Yield shortfall / threshold yield rejection
- Prevented sowing / late sowing / sowing condition rejection

These two categories provide a meaningful but manageable starting point. They are common, rule-based, and documentable from PMFBY policy sources.

### 3.4 Initial Language Scope (v1)
We will support only:
- English
- Hindi

This is a deliberate product choice. The team should demonstrate strong multilingual verification in two languages, rather than claiming poor quality across many languages.

---

## 4. Users and Use Case

### Primary Users
- Smallholder and marginal farmers whose PMFBY claim has been rejected or reduced.
- Bank correspondents, village-level facilitators, or NGO workers assisting the farmer.

### Core Workflow
1. The user provides a rejection notice, either as:
   - a photo/scan from a phone, or
   - typed text.
2. The system extracts the rejection text and shows it back for a quick sanity check.
3. The user provides basic facts such as crop, season, district, and the rejection reason.
4. The system retrieves the relevant PMFBY clauses from the policy corpus.
5. The system decides whether the rejection is supported by the policy evidence.
6. The system outputs:
   - verdict (Supported / Not Supported / Ambiguous)
   - plain-language explanation
   - relevant citation(s)
   - a grievance draft if appropriate
7. A human reviewer checks the output before any action is taken.

---

## 5. Goals and Non-Goals

### Goals
- Determine whether a stated PMFBY rejection reason is supported by the relevant scheme rules.
- Restrict the system to claim-rejection auditing instead of generalized claim adjudication.
- Produce a clear verdict and reasoning in plain language.
- Support both English and Hindi in v1.
- Keep the workflow grounded in the actual policy text rather than general insurance knowledge.
- Add a dedicated verification stage to ensure every important claim is supported by retrieved evidence.
- Show measurable improvement over a direct LLM baseline using a fixed evaluation set.

### Non-Goals
- Not building a full PMFBY adjudication engine.
- Not deciding all claim outcomes or payout amounts.
- Not covering all Indian languages in the first version.
- Not handling live insurer data or sensitive farmer data.
- Not automatically submitting grievances or appeals.

---

## 6. Product Requirements

### 6.1 Core Output
For any audited case, the system must provide:
- A verdict: Supported / Not Supported / Ambiguous
- A plain-language explanation of the decision
- Source-backed citations from the PMFBY policy corpus
- A concise statement of why the rejection is or is not valid
- A grievance draft only when the rejection is likely unsupported or ambiguous

### 6.2 Required Safety and Trust Properties
- The system must never claim a clause exists if it cannot find it in the corpus.
- Every material claim used in the verdict must be traceable to retrieved document text.
- If evidence is weak or missing, the verdict should default to Ambiguous rather than overconfidently concluding support.
- The system must ask clarifying questions when the farmer's statement is incomplete or inconsistent.

### 6.3 Guardrails
The system should remain within PMFBY rejection-audit scope and decline unrelated requests, such as:
- general agronomy advice
- unrelated government schemes
- non-PMFBY legal questions
- requests to guarantee a particular outcome

---

## 7. Success Criteria

### Product-Level Success Metrics
- Verdict accuracy on a held-out synthetic dataset
- Citation accuracy: cited passages actually support the statement made
- Hallucinated clause rate: zero or near-zero fabricated section references
- Verification precision: important claims are checked against source evidence before the final answer is emitted
- Localization fidelity: Hindi output preserves the meaning of the English verdict
- Follow-up coherence: a related question stays grounded in the same case
- Guardrail precision: out-of-scope questions are declined appropriately

### Evaluation Standards
- The model should be judged against ground-truth labels created from actual policy text.
- Every claim in the final verdict must be supported by evidence or clearly marked as uncertain.
- The product should show an improvement over a strong direct-LLM baseline.

---

## 8. Baseline Definition

To satisfy the requirement for a fair and direct comparison, we define the following:

### Baseline
A single direct prompt to an LLM:

"Here is the PMFBY policy text and a claim rejection notice. Is the rejection valid? Answer in Hindi."

Conditions:
- same model
- same policy documents
- same cases
- no retrieval pipeline
- no verification loop
- no explicit evidence check
- no language-specific auditing step

### Proposed Solution
The full pipeline described in Section 9: OCR → case-fact collection → retrieval → reasoning → dedicated verification → localization → grievance draft → human review.

The baseline and solution must be evaluated on the same case set, under the same rubric, to make the improvement measurable and credible.

This comparison is important because it shows whether the system is genuinely using grounded reasoning and verification, rather than relying on generic legal intuition.

---

## 9. System Architecture

### 9.1 Inputs
There are two distinct input types:

1. Policy corpus (controlled source)
   - PMFBY guidelines, operational manuals, state-specific provisions, and public policy text
   - Ingested by the team in a controlled form

2. Claim rejection notice (uncontrolled user input)
   - photo/scan or typed text
   - requires OCR and manual sanity check

### 9.2 High-Level Pipeline

User input
  ↓
OCR / extraction (if image)
  ↓
User sanity-check on extracted text
  ↓
Case-fact collection (crop, season, district, rejection reason)
  ↓
Retrieval agent over PMFBY corpus
  ↓
Reasoning agent: compares rejection reason with retrieved text
  ↓
Verification agent: explicitly checks whether each important claim is supported by evidence
  ↓
Localization agent: translate verdict and reasoning into English/Hindi
  ↓
Grievance drafting agent (if needed)
  ↓
Human review

### 9.3 Dedicated Verification Step
This is a required stage and is central to the product.

The verification agent must do the following for every material claim in the draft verdict:
- identify the important claims being made
- locate the exact retrieved evidence supporting each claim
- check whether the evidence actually says what the claim asserts
- reject or revise unsupported conclusions
- if the evidence is insufficient or conflicting, downgrade confidence or mark the result as ambiguous

This step is not a formality; it is the core mechanism that prevents fabricated clauses and unsupported legal conclusions.

### 9.4 Retrieval and Reasoning
The retrieval layer should fetch only the relevant policy excerpts needed to evaluate the stated rejection. The reasoning layer should compare:
- what the insurer said in the rejection notice
- what the policy text actually requires
- whether the fact pattern matches the rule

The answer should be a rule-based audit, not an attempt to generalize across all PMFBY scenarios.

### 9.5 Localization
In v1, the system will localize output into English and Hindi.

Localization must not be treated as a simple translation step. The system should verify that the Hindi output preserves the same legal meaning as the English verdict. This is particularly important for terms like threshold yield, prevented sowing, cut-off date, or notified/non-notified conditions.

---

## 10. Multi-Turn Orchestration

The system should support follow-up questions in the same case context, but only within PMFBY rejection-audit scope.

We recommend implementing the orchestration as a LangGraph-style stateful flow with these states:
- New case detected
- Case open
- Scope check
- Retrieval and reasoning
- Verification
- Localization
- Human review / follow-up awaiting

The graph should keep track of:
- original rejection notice
- extracted facts
- retrieved clauses
- verdict and citations
- language used in the current turn
- conversation history for this case

A follow-up question may be in English or Hindi, and the system should respond in the user's language for that turn without losing the case context.

Guardrails:
- If the question is out of scope, politely decline.
- If the question is borderline, ask a clarifying question.
- If the question is in scope, answer using the case context and relevant policy evidence only.

---

## 11. Evaluation Plan

### 11.1 Dataset
We will use a synthetic dataset of 10–15 cases, each containing:
- crop and season data
- district context
- rejection notice text
- claimed rejection reason
- ground-truth decision based on the actual policy text

The dataset should include:
- common in-scope scenarios
- at least one adversarial or ambiguous case
- examples across different states/regions
- both supported and unsupported rejection examples

### 11.2 Follow-Up and Guardrail Test Set
A separate small set should test continued interaction:
- 3–5 in-scope follow-ups per sample case
- 3–5 out-of-scope probes
- at least 1 ambiguous-scope question that should trigger clarification instead of guessing

### 11.3 Metrics
| Metric | Baseline | Solution | Expected Direction |
|---|---:|---:|---|
| Verdict accuracy | [value] | [value] | higher |
| Citation accuracy | [value] | [value] | higher |
| Hallucinated clause rate | [value] | [value] | lower |
| Verification pass rate | [value] | [value] | higher |
| Hindi fidelity (meaning preservation) | [value] | [value] | higher |
| Guardrail precision | [value] | [value] | higher |
| Follow-up context retention | [value] | [value] | higher |

### 11.4 Improvement Changelog
| Stage | What was tried | Evidence | Decision |
|---|---|---|---|
| Baseline | Single prompt, no retrieval, no verification | [result] | Established starting point |
| Iteration 1 | Added retrieval over policy text | [result] | kept / revised / removed |
| Iteration 2 | Added explicit verification step | [result] | kept / revised / removed |
| Iteration 3 | Added Hindi localization and meaning checks | [result] | kept / revised / removed |

---

## 12. Key Design Insights

### Narrowing is a product decision, not a limitation
The product should not attempt universal PMFBY adjudication. A narrow, reliable auditor is more useful than a broad but shallow claim engine.

### Verification is essential
A model can retrieve the right rule, but it still needs a dedicated verification step to make sure it does not overstate what the rule says.

### High trust requires evidence discipline
Every important conclusion should be traceable to the corpus. If the evidence is weak or contradictory, the system should say so.

### Strong baseline matters
If direct LLM performance is not clearly worse than the pipeline, the team has not yet demonstrated the value of the engineering investment.

---

## 13. Final Product Positioning

This project is a PMFBY claim-rejection auditor for farmers and facilitators. It helps answer one critical question quickly and responsibly: whether the insurer's rejection reason is actually supported by policy evidence.

The product is intentionally narrow, inspectable, and grounded. It is designed to be useful in the real world while remaining honest about what it does and does not do.