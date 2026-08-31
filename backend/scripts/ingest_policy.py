"""Ingest PMFBY policy text into section-aware chunks with deterministic IDs.

Reads raw text from data/policy/raw/, writes chunks.jsonl + manifest.json.
Chunk ID format: {doc_id}#s{section}#{index} — stable across re-ingests.
"""
import json
import re
import sys
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "policy" / "raw"
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "policy"

SECTION_RE = re.compile(r"^(\d{1,2})\. ([A-Z][^\n]{3,90})$", re.M)
SUBSECTION_RE = re.compile(r"^(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?) ", re.M)

MAX_CHUNK_CHARS = 1800
MIN_CHUNK_CHARS = 120


def clean_text(text: str) -> str:
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
    text = re.sub(r"-\n(?=[a-z])", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def parse_sections(text: str) -> list[tuple[str, str]]:
    """Return (section_label, section_text) pairs for top-level numbered sections.

    Only accepts sequentially increasing section numbers so annexure
    sub-numbering (which restarts at 1) does not collide with main sections.
    """
    matches = list(SECTION_RE.finditer(text))
    sections = []
    expected = 1
    boundaries: list[tuple[int, int, str]] = []
    for m in matches:
        num = int(m.group(1))
        if num == expected:
            boundaries.append((m.start(), num, m.group(0)))
            expected += 1
    for i, (start, num, _) in enumerate(boundaries):
        end = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(text)
        sections.append((str(num), text[start:end].strip()))
    return sections


def split_long(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, cur = [], ""
    for p in paras:
        if cur and len(cur) + len(p) + 2 > max_chars:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    # hard-wrap fallback: oversized paragraphs (tables) get sliced on sentence/line bounds
    final = []
    for c in chunks:
        if len(c) <= max_chars:
            final.append(c)
            continue
        lines = c.split("\n")
        cur, cur_len = [], 0
        for line in lines:
            if cur and cur_len + len(line) + 1 > max_chars:
                final.append("\n".join(cur))
                cur, cur_len = [line], len(line)
            else:
                cur.append(line)
                cur_len += len(line) + 1
        if cur:
            final.append("\n".join(cur))
    return final


def ingest(doc_id: str, title: str, source_url: str, raw_path: Path) -> dict:
    text = clean_text(raw_path.read_text(encoding="utf-8"))
    sections = parse_sections(text)
    chunks = []
    for label, sec_text in sections:
        pieces = split_long(sec_text, MAX_CHUNK_CHARS)
        for i, piece in enumerate(pieces):
            if len(piece) < MIN_CHUNK_CHARS:
                continue
            chunks.append(
                {
                    "chunk_id": f"{doc_id}#s{label}#{i}",
                    "doc_id": doc_id,
                    "title": title,
                    "section": f"Section {label}",
                    "text": piece,
                }
            )
    return {"doc_id": doc_id, "title": title, "source_url": source_url, "n_chunks": len(chunks)}, chunks


def main() -> None:
    docs = [
        {
            "doc_id": "pmfby-og-2023",
            "title": "PMFBY Operational Guidelines 2023",
            "source_url": "https://pmfby.amnex.co.in/pmfby/pdf/operational_guidelines_pmfby.pdf",
            "file": "operational_guidelines_2023.txt",
        }
    ]
    manifest = []
    all_chunks = []
    for doc in docs:
        meta, chunks = ingest(doc["doc_id"], doc["title"], doc["source_url"], RAW_DIR / doc["file"])
        manifest.append(meta)
        all_chunks.extend(chunks)
        print(f"{doc['doc_id']}: {len(chunks)} chunks from {meta['n_chunks']} sections")

    with open(OUT_DIR / "chunks.jsonl", "w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    with open(OUT_DIR / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"total: {len(all_chunks)} chunks")


if __name__ == "__main__":
    sys.exit(main())
