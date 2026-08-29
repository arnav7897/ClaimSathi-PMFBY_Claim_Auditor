"""Multimodal OCR: rejection-notice photo -> raw extracted text (untrusted).

Per claude.md section 8: extracted text is shown to the user for sanity
checking before reasoning runs; output is marked unverified until confirmed.
"""
import base64
import uuid
from pathlib import Path

from pydantic import BaseModel, Field

from davacheck.config import settings
from davacheck.llm import get_llm

UPLOAD_DIR = Path("/tmp/davacheck_uploads")

OCR_PROMPT = """Transcribe ALL text visible in this image of a government/insurance document.
Rules:
- Output the exact text as written, preserving line breaks and layout.
- Do not translate, summarize, correct, or interpret anything.
- If part of the image is unreadable, write [unreadable] at that point.
- Include every number, date, and reference code exactly as shown."""


class OcrResult(BaseModel):
    extracted_text: str
    image_ref: str
    verified: bool = Field(default=False, description="false until user confirms")


def ocr_image(image_bytes: bytes, content_type: str = "image/jpeg") -> OcrResult:
    from google.genai import types

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    image_ref = f"{uuid.uuid4().hex}"
    (UPLOAD_DIR / image_ref).write_bytes(image_bytes)

    client = get_llm()
    response = client._client.models.generate_content(
        model=client.model,
        contents=[
            OCR_PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type=content_type),
        ],
    )
    if not response.text:
        from davacheck.llm import LLMError

        raise LLMError("empty OCR response")
    return OcrResult(extracted_text=response.text.strip(), image_ref=image_ref, verified=False)
