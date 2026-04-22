"""
/pipeline — full end-to-end pipeline:
  1. Ingest sources
  2. Normalize to IntelligenceRecord
  3. Score with HegartyScoringEngine
  4. Validate output
  5. Return PipelineResponse
"""

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import IngestRequest, PipelineResponse
from app.services.ingestion   import ingest_sources
from app.services.normalization import normalize_batch
from app.services.scoring      import HegartyScoringEngine
from app.services.validation   import validate_batch
from app.utils.logger          import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("/run", response_model=PipelineResponse)
async def run_pipeline(
    request: IngestRequest,
    use_llm: bool = Query(True,  description="Use LLM for normalization (falls back to rule-based)"),
    strict:  bool = Query(False, description="Raise on validation failure instead of dropping"),
) -> PipelineResponse:
    """
    Full pipeline execution.

    Steps:
    1. **Ingest** — fetch all sources concurrently with retry logic.
    2. **Normalize** — map raw items to IntelligenceRecord (LLM or rule-based).
    3. **Score** — apply Hegarty Rule to each record.
    4. **Validate** — enforce schema and field constraints.
    5. **Return** — PipelineResponse with scored records and any error log.
    """
    all_errors: list[str] = []

    # ── 1. Ingest ────────────────────────────────────────────────────────────
    logger.info("Pipeline: ingesting %d source(s)…", len(request.sources))
    raw_items, ingest_errors = await ingest_sources(request.sources)
    all_errors.extend(ingest_errors)

    if not raw_items:
        logger.warning("Pipeline: ingestion produced no items. Errors: %s", all_errors)
        return PipelineResponse(
            total_processed=0,
            records=[],
            errors=all_errors,
        )

    # ── 2. Normalize ─────────────────────────────────────────────────────────
    logger.info("Pipeline: normalizing %d item(s) (use_llm=%s)…", len(raw_items), use_llm)
    records, norm_errors = await normalize_batch(raw_items, use_llm=use_llm)
    all_errors.extend(norm_errors)

    # ── 3. Score ─────────────────────────────────────────────────────────────
    logger.info("Pipeline: scoring %d record(s)…", len(records))
    engine  = HegartyScoringEngine()
    scored  = engine.score_batch(records)

    # Log electorate-level context summary
    for name, ctx in engine.electorate_contexts.items():
        if name != "NULL":
            logger.info(
                "Electorate '%s': events=%d, avg_sentiment=%.3f, vulnerable=%s",
                name, ctx.event_count, ctx.avg_sentiment, ctx.is_vulnerable,
            )

    # ── 4. Validate ──────────────────────────────────────────────────────────
    logger.info("Pipeline: validating %d scored record(s)…", len(scored))
    valid_records, val_warnings = validate_batch(scored, strict=strict)
    all_errors.extend(val_warnings)

    return PipelineResponse(
        total_processed=len(valid_records),
        records=valid_records,
        errors=all_errors,
    )
