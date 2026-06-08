from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Query, status

from src.core.container import Container
from src.core.security import get_current_user
from src.schemas.base_schema import FindBase
from src.schemas.users_schemas import (
    Token,
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdate,
)
from src.services.users_service import UsersService

router = APIRouter(prefix="/users", tags=["users"])

# Resolves to the authenticated user's id; presence enforces a valid Bearer token.
CurrentUserId = Annotated[int, Depends(get_current_user)]


# ---- Public: obtain or create credentials ----------------------------------


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
@inject
async def register_user(
    payload: UserCreate,
    service: UsersService = Depends(Provide[Container.users_service]),
):
    return await service.register(payload)


@router.post("/login", response_model=Token)
@inject
async def login(
    payload: UserLogin,
    service: UsersService = Depends(Provide[Container.users_service]),
) -> Token:
    return Token(access_token=await service.authenticate(payload))


# ---- Protected: require a valid Bearer token -------------------------------


@router.get("/me", response_model=UserRead)
@inject
async def read_me(
    current_user_id: CurrentUserId,
    service: UsersService = Depends(Provide[Container.users_service]),
):
    return await service.get_by_id(current_user_id)


@router.get(
    "",
    response_model=list[UserRead],
    tags=["mcp-tools"],
    operation_id="list_users",
)
@inject
async def list_users(
    current_user_id: CurrentUserId,
    service: UsersService = Depends(Provide[Container.users_service]),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    result = await service.get_list(
        FindBase(page=page, page_size=page_size, search=search),
        searchable_fields=["full_name", "email"],
    )
    return result["founds"]


@router.get(
    "/{user_id}",
    response_model=UserRead,
    tags=["mcp-tools"],
    operation_id="get_user",
)
@inject
async def get_user(
    user_id: int,
    current_user_id: CurrentUserId,
    service: UsersService = Depends(Provide[Container.users_service]),
):
    return await service.get_by_id(user_id)


@router.patch("/{user_id}", response_model=UserRead)
@inject
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user_id: CurrentUserId,
    service: UsersService = Depends(Provide[Container.users_service]),
):
    return await service.modify(user_id, payload)


@router.delete("/{user_id}")
@inject
async def delete_user(
    user_id: int,
    current_user_id: CurrentUserId,
    service: UsersService = Depends(Provide[Container.users_service]),
):
    return await service.remove_by_id(user_id)
