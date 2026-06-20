from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    hf_token: str = ""
    gemini_api_key: str = ""
    youtube_api_key: str = ""
    backend_admin_key: str = ""
    backend_env: str = "development"
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://subnota.com"
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
