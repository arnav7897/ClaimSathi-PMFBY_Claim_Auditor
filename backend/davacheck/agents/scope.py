"""Scope-check + follow-up Q&A nodes for the orchestration graph."""
from enum import Enum

from pydantic import BaseModel

from davacheck.llm import get_llm
from davacheck.schemas import CaseFacts


class ScopeDecision(str, Enum):
    IN_SCOPE = "in_scope"
    OUT_OF_SCOPE = "out_of_scope"
    CLARIFY = "clarify"


class ScopeCheck(BaseModel):
    decision: ScopeDecision
    reason: str


SCOPE_PROMPT = """You are the scope guard of DavaCheck, a PMFBY claim-rejection auditor.
The system ONLY answers questions about whether a PMFBY claim rejection reason is
supported by policy evidence, within the current case.

Classify the user's turn:
- in_scope: about the current PMFBY case, its rejection reason, policy rules applied,
  evidence, verdict, or the grievance draft.
- out_of_scope: general agronomy, other government schemes, non-PMFBY legal questions,
  requests to guarantee outcomes, payout calculations, or anything unrelated.
- clarify: borderline — could be in or out of scope given the case.

USER TURN:
{{TURN}}
"""


def check_scope(turn: str) -> ScopeCheck:
    prompt = SCOPE_PROMPT.replace("{{TURN}}", turn)
    return get_llm().generate_structured(prompt, ScopeCheck)


FOLLOWUP_PROMPT = """You answer follow-up questions about a PMFBY rejection-audit case.
Answer ONLY using the case context and cited policy evidence below. If the evidence
does not cover the question, say so plainly — do not guess. Reply in the same
language as the user's turn.

CASE FACTS:
{{FACTS}}

AUDIT VERDICT: {{VERDICT}}
AUDIT EXPLANATION: {{EXPLANATION}}

CITED EVIDENCE:
{{EVIDENCE}}

USER TURN:
{{TURN}}
"""


class FollowUpAnswer(BaseModel):
    answer: str


def answer_followup(
    turn: str,
    facts: CaseFacts,
    verdict: str,
    explanation: str,
    evidence: list,
    language: str = "en",
) -> FollowUpAnswer:
    evidence_block = "\n\n".join(
        f"[{c.chunk_id}] ({c.section}) {c.quote}" for c in evidence
    ) if evidence and hasattr(evidence[0], "chunk_id") else "\n\n".join(
        f"[{c['chunk_id']}] {c['text']}" for c in evidence
    )
    prompt = (
        FOLLOWUP_PROMPT.replace("{{FACTS}}", facts.model_dump_json(indent=2))
        .replace("{{VERDICT}}", verdict)
        .replace("{{EXPLANATION}}", explanation)
        .replace("{{EVIDENCE}}", evidence_block or "(none)")
        .replace("{{TURN}}", turn)
    )
    answer = get_llm().generate_structured(prompt, FollowUpAnswer)
    if language == "hi":
        from davacheck.agents.localization import localize

        answer.answer = localize(answer.answer, "hi")
    return answer
