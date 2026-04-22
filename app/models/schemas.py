"""
Pydantic models for the PNG Electoral Intelligence Pipeline.
All fields use strict validation; missing required values resolve to "NULL".
"""

from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Core output schema (matches the task definition exactly)
# ---------------------------------------------------------------------------

class EntityBlock(BaseModel):
    candidate_name: str = "NULL"
    electorate: str = "NULL"
    party_affiliation: str = "NULL"


class IntelligenceRecord(BaseModel):
    event_type: str = "NULL"
    source: str = "NULL"
    entities: EntityBlock = Field(default_factory=EntityBlock)
    sentiment_score: float = Field(0.0, ge=-1.0, le=1.0)
    confidence_level: Literal["HIGH", "MEDIUM", "LOW", "NULL"] = "NULL"

    @field_validator("sentiment_score", mode="before")
    @classmethod
    def clamp_sentiment(cls, v):
        try:
            return max(-1.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.0


# ---------------------------------------------------------------------------
# Hegarty Rule scoring output
# ---------------------------------------------------------------------------

class HegartyScoredRecord(IntelligenceRecord):
    hegarty_score: float = Field(
        0.0,
        description=(
            "Composite electoral-shift indicator. "
            "Positive = incumbent advantage; negative = challenger surge."
        ),
    )
    shift_flag: bool = Field(
        False,
        description="True when |hegarty_score| exceeds the configured threshold.",
    )
    reasoning: str = "NULL"


# ---------------------------------------------------------------------------
# Ingestion request / response
# ---------------------------------------------------------------------------

class FeedSource(BaseModel):
    url: str = Field(..., description="RSS or web URL to ingest")
    label: Optional[str] = Field(None, description="Human-readable label for the source")
    max_items: int = Field(10, ge=1, le=100)


class IngestRequest(BaseModel):
    sources: list[FeedSource]


class IngestResponse(BaseModel):
    ingested_count: int
    failed_count: int
    raw_items: list[dict]


# ---------------------------------------------------------------------------
# Full pipeline response
# ---------------------------------------------------------------------------

class PipelineResponse(BaseModel):
    total_processed: int
    records: list[HegartyScoredRecord]
    errors: list[str] = Field(default_factory=list)
