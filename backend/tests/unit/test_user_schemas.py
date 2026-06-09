from datetime import UTC, datetime

from bson import ObjectId

from src.schemas.users_schemas import UserRead


def test_userread_coerces_objectid_to_str():
    oid = ObjectId()
    now = datetime.now(UTC)
    user = UserRead.model_validate(
        {
            "id": oid,
            "email": "a@b.com",
            "full_name": "A B",
            "is_active": True,
            "is_superuser": False,
            "created_at": now,
            "updated_at": now,
        }
    )
    assert user.id == str(oid)
    assert isinstance(user.id, str)
