import re

from beanie import PydanticObjectId

from src.core.exceptions import DuplicatedError, NotFoundError, UnauthorizedError
from src.core.security import create_access_token, hash_password, verify_password
from src.core.validators import validate_password
from src.models.base import utcnow
from src.models.user import User
from src.schemas.users_schemas import UserCreate, UserLogin, UserUpdate


class UsersService:
    """User auth + CRUD over the Beanie ``User`` document."""

    async def register(self, payload: UserCreate) -> User:
        validate_password(payload.password)
        if await User.find_one(User.email == payload.email):
            raise DuplicatedError(detail="A user with this email already exists")

        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
        )
        await user.insert()
        return user

    async def authenticate(self, credentials: UserLogin) -> str:
        user = await User.find_one(User.email == credentials.email)
        if user is None or not verify_password(
            credentials.password, user.hashed_password
        ):
            raise UnauthorizedError(detail="Invalid email or password")
        if not user.is_active:
            raise UnauthorizedError(detail="User account is inactive")
        return create_access_token(subject=str(user.id))

    async def get_by_id(self, user_id: str) -> User:
        user = (
            await User.get(PydanticObjectId(user_id))
            if PydanticObjectId.is_valid(user_id)
            else None
        )
        if user is None:
            raise NotFoundError(detail=f"User {user_id} not found")
        return user

    async def list_users(
        self, page: int, page_size: int, search: str | None
    ) -> list[User]:
        if search:
            rx = {"$regex": re.escape(search), "$options": "i"}
            query = User.find({"$or": [{"email": rx}, {"full_name": rx}]})
        else:
            query = User.find()
        return await query.skip((page - 1) * page_size).limit(page_size).to_list()

    async def modify(self, user_id: str, payload: UserUpdate) -> User:
        user = await self.get_by_id(user_id)
        data = payload.model_dump(exclude_none=True)
        if "password" in data:
            validate_password(data["password"])
            user.hashed_password = hash_password(data.pop("password"))
        for key, value in data.items():
            setattr(user, key, value)
        user.updated_at = utcnow()
        await user.save()
        return user

    async def remove_by_id(self, user_id: str) -> dict[str, str]:
        user = await self.get_by_id(user_id)
        await user.delete()
        return {"message": f"User {user_id} deleted successfully."}
