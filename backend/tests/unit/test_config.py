import pytest
from pydantic import ValidationError

from src.core.config import _PLACEHOLDER_JWT_SECRET, Config
from src.schemas.users_schemas import UserUpdate


def test_user_update_omits_privileged_fields():
    # Mass-assignment guard: clients must not be able to set role/status.
    fields = set(UserUpdate.model_fields)
    assert "is_superuser" not in fields
    assert "is_active" not in fields


def test_prod_rejects_placeholder_jwt_secret():
    with pytest.raises(ValidationError):
        Config(ENV="prod", JWT_SECRET_KEY=_PLACEHOLDER_JWT_SECRET)


def test_prod_rejects_short_jwt_secret():
    with pytest.raises(ValidationError):
        Config(ENV="prod", JWT_SECRET_KEY="too-short")


def test_prod_accepts_strong_jwt_secret():
    cfg = Config(ENV="prod", JWT_SECRET_KEY="x" * 40)
    assert cfg.ENV.value == "prod"


def test_dev_allows_placeholder_secret():
    cfg = Config(ENV="dev", JWT_SECRET_KEY=_PLACEHOLDER_JWT_SECRET)
    assert cfg.DEBUG is True


def test_mongodb_db_default_is_homeward():
    cfg = Config(ENV="dev")
    assert cfg.MONGODB_DB == "homeward"


def test_blank_clinic_timezone_uses_default():
    cfg = Config(ENV="dev", CLINIC_TIMEZONE="")
    assert cfg.CLINIC_TIMEZONE == "America/New_York"
