"""
/ingest — trigger ingestion of one or more RSS / web sources.
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import IngestRequest, IngestResponse
from app.services.ingestion import ingest_sources
from app.utils.logger import get_logger

router  = APIRouter()
logger  = get_logger(__name__)


@router.post("/", response_model=IngestResponse)
async def ingest(request: IngestRequest) -> IngestResponse:
    """
    Fetch all requested sources and return the raw items.
    Does NOT run normalization or scoring — use /pipeline for the full flow.
    """
    if not request.sources:
        raise HTTPException(status_code=422, detail="At least one source is required.")

    items, errors = await ingest_sources(request.sources)

    if not items and errors:
        raise HTTPException(
            status_code=502,
            detail={"message": "All sources failed.", "errors": errors},
        )

    return IngestResponse(
        ingested_count=len(items),
        failed_count=len(errors),
        raw_items=items,
    )
