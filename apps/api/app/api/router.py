from fastapi import APIRouter

from app.api.routes import audit, auth, incidents, investigations, knowledge, system

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(incidents.router)
api_router.include_router(investigations.router)
api_router.include_router(knowledge.router)
api_router.include_router(audit.router)
api_router.include_router(system.router)
