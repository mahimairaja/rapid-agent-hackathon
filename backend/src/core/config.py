import logging
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.core.enums import EnvironmentOption

load_dotenv(override=False)


logger = logging.getLogger(__name__)

# Dev placeholder for JWT_SECRET_KEY. Production startup fails fast (see the
# Config validator) if this is left unchanged or the secret is too short.
_PLACEHOLDER_JWT_SECRET = "change-me-in-prod-change-me-in-prod-32chars-min"
_MIN_JWT_SECRET_LEN = 32


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    ENV: EnvironmentOption = EnvironmentOption.PROD
    DEBUG: bool | None = None

    API: str = "/api"
    API_V1_STR: str = "/api/v1"
    API_STR: str = "/api"

    MCP_STR: str = "/mcp"
    MCP_SERVER_URL: str = "http://127.0.0.1:8000/mcp"

    PROJECT_NAME: str = "Rapid Recovery"

    # CORS. CORS_ORIGINS_STR is a comma-separated allow-list; empty means allow
    # all ("*"). BACKEND_CORS_ORIGINS is derived from it at load time by
    # ``derive_cors_origins`` below (it must not be a class-level computed
    # default, which would capture the literal "" before the env is read).
    CORS_ORIGINS_STR: str | None = ""
    BACKEND_CORS_ORIGINS: list[str] | None = None

    # MongoDB Atlas. MONGODB_URI is the SRV connection string
    # (mongodb+srv://...). Optional so tests / tooling can import config without
    # a database; src/core/database.py raises clearly if it is missing at connect time.
    MONGODB_URI: SecretStr | None = None
    MONGODB_DB: str = "homeward"

    # Embeddings (Voyage AI)
    VOYAGE_API_KEY: SecretStr | None = None
    VOYAGE_MODEL: str = "voyage-3.5"
    VOYAGE_DIM: int = 1024

    # Agent (Google ADK / Gemini). GOOGLE_API_KEY uses Google AI Studio; set
    # GOOGLE_GENAI_USE_VERTEXAI=true to authenticate via Vertex AI instead.
    # GEMINI_MODEL is overridable (set to the team's Gemini 3 id when chosen).
    GOOGLE_API_KEY: SecretStr | None = None
    GOOGLE_GENAI_USE_VERTEXAI: bool = False
    GEMINI_MODEL: str = "gemini-3-flash-preview"

    # Voice (F6). GEMINI_LIVE_MODEL must be a Gemini Live model that advertises
    # bidiGenerateContent; the voice agent reuses the same tools/prompts as the
    # text agent but with this model. Availability shifts: gemini-2.0-flash-live
    # and the gemini-2.5 native-audio models (incl. the "-latest" alias) can close
    # the live socket with APIError 1008/1011 on this key, so the default is the
    # gemini-3.1 live model, which connects and streams audio + transcription. If
    # it is unavailable on your key, list models with client.models.list() (filter
    # supported_actions for bidiGenerateContent) and set another id.
    GEMINI_LIVE_MODEL: str = "gemini-3.1-flash-live-preview"
    VOICE_INPUT_SAMPLE_RATE: int = 16000
    VOICE_OUTPUT_SAMPLE_RATE: int = 24000

    # Clinic-local timezone for medication dose times (F3 get_next_dose computes
    # the next dose against this wall clock). IANA name.
    CLINIC_TIMEZONE: str = "America/New_York"

    CAL_API_KEY: SecretStr | None = None
    CAL_API_BASE_URL: str = "https://api.cal.com"
    CAL_SLOTS_API_VERSION: str = "2024-09-04"
    CAL_BOOKINGS_API_VERSION: str = "2026-02-25"
    CAL_USERNAME: str | None = None
    CAL_EVENT_TYPE_SLUG: str | None = None

    # Auth (JWT)
    JWT_SECRET_KEY: SecretStr = SecretStr(_PLACEHOLDER_JWT_SECRET)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Pagination defaults
    PAGE: int = 1
    PAGE_SIZE: int = 20

    @field_validator("CLINIC_TIMEZONE", mode="before")
    @classmethod
    def default_blank_clinic_timezone(cls, value):
        if value is None or str(value).strip() == "":
            return "America/New_York"
        return value

    @model_validator(mode="after")
    def derive_cors_origins(self):
        """Build the CORS allow-list from the (env-resolved) CORS_ORIGINS_STR.

        An explicit BACKEND_CORS_ORIGINS (set directly via env) wins; otherwise a
        non-empty CORS_ORIGINS_STR is split into an allow-list, and an empty
        value falls back to allow-all ("*").
        """
        if self.BACKEND_CORS_ORIGINS is None:
            raw = (self.CORS_ORIGINS_STR or "").strip()
            parsed = [o.strip() for o in raw.split(",") if o.strip()]
            # Fall back to allow-all when nothing usable is configured, so a
            # blank or all-separator value never silently disables CORS.
            self.BACKEND_CORS_ORIGINS = parsed or ["*"]
        return self

    @model_validator(mode="after")
    def set_debug_default(self):
        if self.DEBUG is None:
            self.DEBUG = self.ENV == EnvironmentOption.DEV
        return self

    @model_validator(mode="after")
    def enforce_prod_secret(self):
        """Fail fast in production if the JWT secret is the placeholder or weak."""
        if self.ENV == EnvironmentOption.PROD:
            secret = self.JWT_SECRET_KEY.get_secret_value()
            if secret == _PLACEHOLDER_JWT_SECRET or len(secret) < _MIN_JWT_SECRET_LEN:
                raise ValueError(
                    "JWT_SECRET_KEY must be set to a strong, unique value "
                    f"(>= {_MIN_JWT_SECRET_LEN} chars) when ENV=prod"
                )
        return self


@lru_cache
def get_config() -> Config:
    return Config()


config = get_config()
