from fastapi import APIRouter

from src.api.endpoints.agent import router as agent_router
from src.api.endpoints.onboarding import router as onboarding_router
from src.api.endpoints.patients import router as patients_router
from src.api.endpoints.users import router as users_router
from src.api.endpoints.voice import router as voice_router

routers = APIRouter(prefix="/v1")
routers.include_router(users_router)
routers.include_router(agent_router)
routers.include_router(onboarding_router)
routers.include_router(patients_router)
routers.include_router(voice_router)
