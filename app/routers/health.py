from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()


@router.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "PNG Electoral Intelligence Pipeline",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
