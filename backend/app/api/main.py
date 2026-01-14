from fastapi import APIRouter

from app.api.routes import audio, utils

api_router = APIRouter()
api_router.include_router(utils.router)
api_router.include_router(audio.router)
