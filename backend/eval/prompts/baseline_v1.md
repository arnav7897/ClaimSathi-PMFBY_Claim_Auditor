# Baseline prompt v1 (PRD section 8)

Here is the PMFBY policy text and a claim rejection notice. Is the rejection valid?
Answer with a JSON object: {"verdict": "SUPPORTED"|"NOT_SUPPORTED"|"INSUFFICIENT_EVIDENCE", "explanation": "..."}.
SUPPORTED means the rejection reason is justified by the policy text; NOT_SUPPORTED
means the policy text contradicts it; INSUFFICIENT_EVIDENCE means the text does not
establish or refute it.

CASE FACTS:
{{FACTS}}

REJECTION NOTICE:
{{NOTICE}}

PMFBY POLICY TEXT (relevant sections attached in full):
{{POLICY}}
