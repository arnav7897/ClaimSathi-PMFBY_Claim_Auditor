"""BM25 retrieval over the PMFBY policy corpus.

Deterministic, pure-code retrieval — no LLM. Loads chunks.jsonl produced by
scripts/ingest_policy.py and serves top-k chunks per query.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

from rank_bm25 import BM25Okapi

from davacheck.config import settings

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


class PolicyIndex:
    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self._bm25 = BM25Okapi([tokenize(c["text"]) for c in chunks])

    def search(self, query: str, top_k: int | None = None) -> list[dict]:
        k = top_k or settings.retrieval_top_k
        scores = self._bm25.get_scores(tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        results = []
        for i in ranked[:k]:
            if scores[i] <= 0:
                break
            chunk = dict(self.chunks[i])
            chunk["score"] = float(scores[i])
            results.append(chunk)
        return results


@lru_cache(maxsize=1)
def get_index() -> PolicyIndex:
    chunks_path = settings.policy_data_dir / "chunks.jsonl"
    chunks = [json.loads(line) for line in chunks_path.read_text(encoding="utf-8").splitlines()]
    return PolicyIndex(chunks)
