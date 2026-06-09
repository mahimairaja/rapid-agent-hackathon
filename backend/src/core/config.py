import logging
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import SecretStr, model_validator
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

    PROJECT_NAME: str = "Rapid Agent"

    # CORS
    CORS_ORIGINS_STR: str | None = ""
    BACKEND_CORS_ORIGINS: list[str] | None = (
        [origin.strip() for origin in CORS_ORIGINS_STR.split(",")]
        if CORS_ORIGINS_STR
        else ["*"]
    )

    # MongoDB Atlas. MONGODB_URI is the SRV connection string
    # (mongodb+srv://...). Optional so tests / tooling can import config without
    # a database; src/db/mongo.py raises clearly if it is missing at connect time.
    MONGODB_URI: SecretStr | None = None
    MONGODB_DB: str = "homeward"

    # Embeddings (Voyage AI)
    VOYAGE_API_KEY: SecretStr | None = None
    VOYAGE_MODEL: str = "voyage-3.5"
    VOYAGE_DIM: int = 1024

    # Auth (JWT)
    JWT_SECRET_KEY: SecretStr = SecretStr(_PLACEHOLDER_JWT_SECRET)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Pagination defaults
    PAGE: int = 1
    PAGE_SIZE: int = 20

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
