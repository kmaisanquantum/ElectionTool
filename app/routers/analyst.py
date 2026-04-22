from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

class AnalystRequest(BaseModel):
    records: list

@router.post("/query")
async def query_analyst(request: AnalystRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    context = str(request.records)
    payload = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1000,
        "system": "You are a senior electoral analyst specializing in Papua New Guinea politics. Analyze the provided intelligence records and provide a concise, high-impact assessment of shifts, risks, and trends.",
        "messages": [
            {"role": "user", "content": f"Intelligence Records:\n{context}"}
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01"
                },
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Analyst query failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
