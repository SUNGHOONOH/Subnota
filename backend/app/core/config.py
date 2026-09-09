from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_db_timeout_seconds: float = 8.0
    hf_token: str = ""
    gemini_api_key: str = ""
    youtube_api_key: str = ""
    backend_admin_key: str = ""
    # Fail closed when a deployment forgets to provide BACKEND_ENV. Local
    # development still opts in through backend/.env or .env.example.
    backend_env: str = "production"
    allow_local_admin_bypass: bool = False
    enable_playwright_fetch: bool = False
    # Development origins belong in a local .env, never in the production
    # fallback used by a hosted service.
    cors_allow_origins: str = "subnota-app://bundle,https://subnota.com"
    hf_timeout_seconds: float = 8.0
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
