"""Evaluation runner: direct-LLM baseline vs full pipeline on the same fixed cases.

Usage: .venv/bin/python -m eval.run_eval [--baseline-only|--pipeline-only]
Writes results JSON to eval/results_<ts>.json and prints a metrics table.
Model/version/config logged per run (claude.md section 6). Only measured numbers.
"""
import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel

from davacheck.config import settings
from davacheck.schemas import AuditResult, CaseFacts, Verdict

EVAL_DIR = Path(__file__).resolve().parent
DATASET = EVAL_DIR / "dataset.json"


class BaselineAnswer(BaseModel):
    verdict: Verdict
    explanation: str


def load_cases() -> list[dict]:
    return json.loads(DATASET.read_text(encoding="utf-8"))["cases"]


def to_facts(case: dict) -> CaseFacts:
    return CaseFacts.model_validate(case["facts"])


def run_baseline(case: dict) -> dict:
    """Single direct prompt, same model + same policy docs, no pipeline (PRD section 8)."""
    from davacheck.llm import get_llm
    from davacheck.retrieval import get_index

    template = (EVAL_DIR / "prompts" / "baseline_v1.md").read_text(encoding="utf-8")
    facts = to_facts(case)
    # same evidence availability as pipeline: attach the raw policy sections
    # (not pipeline-processed) by retrieving on the notice text only
    evidence = get_index().search(case["notice_text"], top_k=15)
    policy_block = "\n\n".join(f"[{e['chunk_id']}] {e['text']}" for e in evidence)
    prompt = (
        template.replace("{{FACTS}}", facts.model_dump_json(indent=2))
        .replace("{{NOTICE}}", case["notice_text"])
        .replace("{{POLICY}}", policy_block)
    )
    answer = get_llm().generate_structured(prompt, BaselineAnswer)
    cited = any(cid in answer.explanation for cid in [e["chunk_id"] for e in evidence])
    return {
        "verdict": answer.verdict.value,
        "explanation": answer.explanation,
        "citation_ids_in_explanation": cited,
        "n_citations": 0,
        "fabricated_citation_rate": None,
    }


def run_pipeline(case: dict) -> dict:
    from davacheck.pipeline import run_audit

    facts = to_facts(case)
    result, events = run_audit(facts, case["notice_text"])
    n_valid = len(result.citations)
    fabricated = [e for e in events if "fabricated" in e.detail]
    return {
        "verdict": result.verdict.value,
        "explanation": result.explanation,
        "citation_ids_in_explanation": n_valid > 0,
        "n_citations": n_valid,
        "fabricated_citation_rate": len(fabricated) / max(len(result.material_claims), 1),
        "verification_events": sum(1 for e in events if e.stage == "verification"),
    }


def score(results: list[dict], cases: list[dict]) -> dict:
    n = len(cases)
    verdict_correct = sum(1 for r, c in zip(results, cases) if r["verdict"] == c["ground_truth"])
    citation_present = sum(1 for r, c in zip(results, cases)
                           if r["verdict"] != "INSUFFICIENT_EVIDENCE" and r["n_citations"] > 0)
    fabricated = [r["fabricated_citation_rate"] for r in results if r["fabricated_citation_rate"]]
    return {
        "n_cases": n,
        "verdict_accuracy": round(verdict_correct / n, 3),
        "citation_coverage_on_decisive_verdicts": round(citation_present / max(
            sum(1 for r in results if r["verdict"] != "INSUFFICIENT_EVIDENCE"), 1), 3),
        "hallucinated_citation_rate": round(sum(fabricated) / len(fabricated), 3) if fabricated else 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-only", action="store_true")
    parser.add_argument("--pipeline-only", action="store_true")
    args = parser.parse_args()

    cases = load_cases()
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    out: dict = {
        "run_id": run_id,
        "model": settings.gemini_model,
        "retrieval_top_k": settings.retrieval_top_k,
        "n_cases": len(cases),
    }

    if not args.pipeline_only:
        t0 = time.time()
        base_results = [run_baseline(c) for c in cases]
        out["baseline"] = {"metrics": score(base_results, cases), "per_case": base_results,
                           "elapsed_s": round(time.time() - t0, 1)}

    if not args.baseline_only:
        t0 = time.time()
        pipe_results = [run_pipeline(c) for c in cases]
        out["pipeline"] = {"metrics": score(pipe_results, cases), "per_case": pipe_results,
                           "elapsed_s": round(time.time() - t0, 1)}

    out_path = EVAL_DIR / f"results_{run_id}.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"run_id={run_id} model={settings.gemini_model} n={len(cases)}")
    for arm in ("baseline", "pipeline"):
        if arm in out:
            m = out[arm]["metrics"]
            print(f"{arm:9s} verdict_accuracy={m['verdict_accuracy']} "
                  f"citation_coverage={m['citation_coverage_on_decisive_verdicts']} "
                  f"hallucination_rate={m['hallucinated_citation_rate']} "
                  f"({out[arm]['elapsed_s']}s)")
    print(f"saved -> {out_path}")


if __name__ == "__main__":
    main()
