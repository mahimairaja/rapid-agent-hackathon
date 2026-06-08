import logging
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.core.enums import EnvironmentOption

load_dotenv(override=False)


logger = logging.getLogger(__name__)


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

    PROJECT_NAME: str = "Template Backend"

    # CORS
    CORS_ORIGINS_STR: str | None = ""
    BACKEND_CORS_ORIGINS: list[str] | None = (
        [origin.strip() for origin in CORS_ORIGINS_STR.split(",")] if CORS_ORIGINS_STR else ["*"]
    )

    # Database
    DATABASE_URL: str | None = None
    DB_USER: str | None = None
    DB_HOST: str | None = None
    DB_PORT: int | None = None
    DB_NAME: str | None = None
    DB_PASSWORD: SecretStr | None = None
    DB_SSL: str | None = None
    DB_FORCE_ROLL_BACK: bool = False

    @model_validator(mode="after")
    def set_debug_default(self):
        if self.DEBUG is None:
            self.DEBUG = self.ENV == EnvironmentOption.DEV
        return self

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        from urllib.parse import quote_plus

        if self.DATABASE_URL:
            return self.DATABASE_URL

        if not all([self.DB_USER, self.DB_HOST, self.DB_PORT, self.DB_NAME, self.DB_PASSWORD]):
            raise ValueError(
                "Either DATABASE_URL or all DB_* fields (DB_USER, DB_HOST, DB_PORT, DB_NAME, DB_PASSWORD) must be set"
            )

        db_password = quote_plus(self.DB_PASSWORD.get_secret_value())
        return (
            f"postgresql+asyncpg://{quote_plus(self.DB_USER)}:{db_password}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def SQLALCHEMY_CONNECT_ARGS(self) -> dict[str, object]:
        args: dict[str, object] = {"statement_cache_size": 0}

        if self.DB_SSL:
            ssl_mode = self.DB_SSL.strip().lower()
            if ssl_mode in {"disable", "false", "0", "no"}:
                args["ssl"] = False
            else:
                # asyncpg accepts bool/SSLContext; map common modes to enabled TLS.
                args["ssl"] = True

        return args

    JWT_SECRET_KEY: SecretStr = SecretStr("change-me-in-prod-change-me-in-prod-32chars-min")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # find query
    PAGE: int = 1
    PAGE_SIZE: int = 10
    ORDERING: str = "-id"


@lru_cache
def get_config() -> Config:
    return Config()


config = get_config()
