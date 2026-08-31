"""Thin Gemini wrapper. Structured output helper + model/version logging."""
import json
import logging
from typing import Type, TypeVar

from pydantic import BaseModel

from davacheck.config import settings

logger = logging.getLogger("davacheck.llm")

T = TypeVar("T", bound=BaseModel)
LEGACY_MODEL_ALIASES = {
    "gemini-2.5-flash": "gemini-3.6-flash",
}


class LLMError(Exception):
    pass


class GeminiClient:
    def __init__(self):
        if not settings.gemini_api_key:
            raise LLMError("GEMINI_API_KEY not set — cannot call Gemini")
        from google import genai

        self._client = genai.Client(api_key=settings.gemini_api_key)
        self.model = LEGACY_MODEL_ALIASES.get(settings.gemini_model, settings.gemini_model)
        if self.model != settings.gemini_model:
            logger.warning("mapped_legacy_model from=%s to=%s", settings.gemini_model, self.model)

    def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": schema,
            },
        )
        logger.info("llm_call model=%s schema=%s", self.model, schema.__name__)
        if not response.text:
            raise LLMError("empty Gemini response")
        try:
            return schema.model_validate_json(response.text)
        except Exception as e:
            raise LLMError(f"schema validation failed for {schema.__name__}: {e}") from e

    def generate_text(self, prompt: str) -> str:
        response = self._client.models.generate_content(model=self.model, contents=prompt)
        logger.info("llm_call model=%s kind=text", self.model)
        if not response.text:
            raise LLMError("empty Gemini response")
        return response.text


_client: GeminiClient | None = None


def get_llm() -> GeminiClient:
    global _client
    if _client is None:
        _client = GeminiClient()
    return _client
