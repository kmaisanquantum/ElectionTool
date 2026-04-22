"""
PNG Electoral Intelligence Pipeline
FastAPI entrypoint — orchestrates ingestion, normalization, extraction, and scoring.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ingest, pipeline, health
from app.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PNG Electoral Intelligence Pipeline starting up...")
    yield
    logger.info("Pipeline shutting down.")


app = FastAPI(
    title="PNG Electoral Intelligence Pipeline",
    description=(
        "Automated ingestion, normalization, entity extraction, and Hegarty-Rule "
        "scoring for Papua New Guinea political and electoral data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(ingest.router, prefix="/ingest", tags=["Ingestion"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
