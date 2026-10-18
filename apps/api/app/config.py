from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="OPSMIND_",
        extra="ignore",
    )

    app_name: str = "OpsMind AI"
    environment: str = "development"
    database_url: str = "sqlite:///./data/opsmind.db"
    jwt_secret: str = "development-only-change-this-secret"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )
    seed_demo_data: bool = True
    demo_user_password: str = "OpsMind!2026"
    embedding_dimensions: int = 256
    llm_mode: str = "demo"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4.1-mini"
    llm_timeout_seconds: float = 45.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
