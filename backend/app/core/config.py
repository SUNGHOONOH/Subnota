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
    backend_env: str = "development"
    cors_allow_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "subnota-app://bundle,https://subnota.com"
    )
    hf_timeout_seconds: float = 8.0
    log_level: str = "INFO"
    network_rate_limit_per_minute: int = 30
    chunk_split_rate_limit_per_minute: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
