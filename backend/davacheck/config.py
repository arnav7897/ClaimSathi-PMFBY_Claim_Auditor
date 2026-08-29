"""Environment configuration. Secrets live in .env only (claude.md section 9)."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    policy_data_dir: Path = BACKEND_ROOT / "data" / "policy"
    retrieval_top_k: int = 6


settings = Settings()
