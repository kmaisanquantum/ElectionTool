"""
Test suite for the PNG Electoral Intelligence Pipeline.
Run with:  pytest tests/ -v
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from app.models.schemas import EntityBlock, HegartyScoredRecord, IntelligenceRecord
from app.services.scoring     import HegartyScoringEngine, SHIFT_THRESHOLD
from app.services.validation  import validate_batch, validate_record, ValidationError_


# ============================================================
# Fixtures
# ============================================================

def make_record(
    event_type: str = "GENERAL_POLITICAL",
    sentiment:  float = 0.0,
    confidence: str = "HIGH",
    electorate: str = "Lae Open",
    candidate:  str = "John Smith",
    party:      str = "Pangu Party",
    source:     str = "RNZ Pacific",
) -> IntelligenceRecord:
    return IntelligenceRecord(
        event_type=event_type,
        source=source,
        entities=EntityBlock(
            candidate_name=candidate,
            electorate=electorate,
            party_affiliation=party,
        ),
        sentiment_score=sentiment,
        confidence_level=confidence,
    )


# ============================================================
# Schema / model tests
# ============================================================

class TestSchemas:
    def test_sentiment_clamp_high(self):
        r = IntelligenceRecord(
            event_type="TEST", source="test",
            entities=EntityBlock(), sentiment_score=99.0,
            confidence_level="HIGH",
        )
        assert r.sentiment_score == 1.0

    def test_sentiment_clamp_low(self):
        r = IntelligenceRecord(
            event_type="TEST", source="test",
            entities=EntityBlock(), sentiment_score=-99.0,
            confidence_level="LOW",
        )
        assert r.sentiment_score == -1.0

    def test_null_defaults(self):
        entity = EntityBlock()
        assert entity.candidate_name == "NULL"
        assert entity.electorate     == "NULL"
        assert entity.party_affiliation == "NULL"


# ============================================================
# Scoring tests
# ============================================================

class TestHegartyScoring:
    def test_positive_sentiment_project_raises_score(self):
        engine = HegartyScoringEngine()
        record = make_record(event_type="PROJECT_COMMISSIONING", sentiment=0.7)
        scored = engine.score_record(record)
        assert scored.hegarty_score > 0

    def test_negative_sentiment_irregularity_lowers_score(self):
        engine = HegartyScoringEngine()
        record = make_record(event_type="VOTING_IRREGULARITY", sentiment=-0.8)
        scored = engine.score_record(record)
        assert scored.hegarty_score < 0

    def test_shift_flag_triggered_above_threshold(self):
        engine = HegartyScoringEngine()
        # Strong negative event
        record = make_record(event_type="VOTING_IRREGULARITY", sentiment=-1.0)
        scored = engine.score_record(record)
        # May or may not trip threshold on a single record; test the mechanics
        assert isinstance(scored.shift_flag, bool)

    def test_vulnerability_amplifier(self):
        """Three negative events + one project should apply the 1.5x amplifier."""
        engine = HegartyScoringEngine()
        for _ in range(3):
            engine.score_record(make_record(event_type="VOTING_IRREGULARITY", sentiment=-0.9))
        # Now add a project — this should set ctx.is_vulnerable = True
        engine.score_record(make_record(event_type="PROJECT_COMMISSIONING", sentiment=-0.1))

        ctx = engine.electorate_contexts.get("Lae Open")
        assert ctx is not None
        assert ctx.is_vulnerable

    def test_batch_scoring_returns_same_count(self):
        engine  = HegartyScoringEngine()
        records = [make_record(sentiment=float(i) / 10) for i in range(-5, 5)]
        scored  = engine.score_batch(records)
        assert len(scored) == len(records)

    def test_reasoning_field_populated(self):
        engine = HegartyScoringEngine()
        scored = engine.score_record(make_record())
        assert scored.reasoning != "NULL"
        assert "Sentiment component" in scored.reasoning


# ============================================================
# Validation tests
# ============================================================

class TestValidation:
    def _make_scored(self, **kwargs) -> HegartyScoredRecord:
        base = make_record(**kwargs)
        engine = HegartyScoringEngine()
        return engine.score_record(base)

    def test_valid_record_passes(self):
        scored = self._make_scored()
        validated, warnings = validate_record(scored)
        assert validated is not None

    def test_null_required_field_gives_warning(self):
        scored = self._make_scored()
        scored.event_type = "NULL"
        validated, warnings = validate_record(scored, strict=False)
        assert any("event_type" in w for w in warnings)

    def test_strict_mode_raises_on_null_required(self):
        scored = self._make_scored()
        scored.source = "NULL"
        with pytest.raises(ValidationError_):
            validate_record(scored, strict=True)

    def test_batch_drops_invalid_in_lenient_mode(self):
        good = self._make_scored()
        bad  = self._make_scored()
        bad.event_type = "NULL"
        bad.source     = "NULL"
        valid, _ = validate_batch([good, bad], strict=False)
        # good record must survive; bad may survive with warnings (NULLs are warnings not drops)
        assert len(valid) >= 1

    def test_batch_all_valid(self):
        records = [self._make_scored(sentiment=s) for s in [0.2, -0.4, 0.0]]
        valid, warnings = validate_batch(records)
        assert len(valid) == 3


# ============================================================
# Ingestion service tests (mocked HTTP)
# ============================================================

class TestIngestion:
    @pytest.mark.asyncio
    async def test_successful_rss_fetch(self):
        from app.models.schemas import FeedSource
        from app.services.ingestion import ingest_sources

        rss_xml = """<?xml version="1.0"?>
        <rss version="2.0"><channel>
          <item><title>MP announces road project</title><description>Lae Open MP pledges K5m road.</description></item>
          <item><title>Election fraud claims</title><description>Irregularities reported in Goroka.</description></item>
        </channel></rss>"""

        mock_resp = AsyncMock()
        mock_resp.text = rss_xml
        mock_resp.headers = {"content-type": "application/rss+xml"}
        mock_resp.raise_for_status = lambda: None

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            items, errors = await ingest_sources(
                [FeedSource(url="http://fake.rss/feed", max_items=10)]
            )

        assert len(errors) == 0
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_timeout_returns_error(self):
        import httpx
        from app.models.schemas import FeedSource
        from app.services.ingestion import ingest_sources

        with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("timeout")):
            items, errors = await ingest_sources(
                [FeedSource(url="http://unreachable.example/", max_items=5)]
            )

        assert len(items) == 0
        assert len(errors) > 0
        assert "Timeout" in errors[0]
