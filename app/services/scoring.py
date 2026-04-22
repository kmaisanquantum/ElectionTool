"""
Hegarty Rule Scoring Service
-----------------------------
Applies the Hegarty Rule — a composite electoral-shift indicator adapted
for PNG's Limited Preferential Voting (LPV) system.

The Hegarty Rule (named after electoral analyst Bob Hegarty) posits that
an incumbent is vulnerable when:
  - A visible infrastructure project is commissioned near polling day, AND
  - Sentiment toward the challenger is net positive in the same electorate, OR
  - The incumbent has accumulated negative sentiment across >= 3 recent events.

Score formula (per record):
  hegarty_score = (sentiment_weight × sentiment_score)
                + (event_weight    × event_type_modifier)
                + (confidence_adj  × confidence_multiplier)

Positive score  → incumbent advantage / stability signal
Negative score  → challenger surge / electoral shift signal
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import ClassVar

from app.models.schemas import HegartyScoredRecord, IntelligenceRecord
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Weights — tune these via config / environment variables in production
# ---------------------------------------------------------------------------

SENTIMENT_WEIGHT:    float = 0.50
EVENT_WEIGHT:        float = 0.35
CONFIDENCE_WEIGHT:   float = 0.15
SHIFT_THRESHOLD:     float = 0.40   # |hegarty_score| above this trips the flag


# ---------------------------------------------------------------------------
# Event-type modifiers
# (positive = favours incumbent; negative = favours challenger / instability)
# ---------------------------------------------------------------------------

EVENT_MODIFIERS: dict[str, float] = {
    "ELECTORAL_RESULT":       +1.0,
    "CANDIDATE_ANNOUNCEMENT": -0.3,   # new challenger entering = pressure
    "PROJECT_COMMISSIONING":  +0.6,   # pork-barrel signal → incumbent benefit
    "VOTING_IRREGULARITY":    -0.8,   # destabilising
    "POLICY_STATEMENT":       +0.1,
    "ALLIANCE_FORMATION":     -0.2,   # realignment = uncertainty
    "GENERAL_POLITICAL":       0.0,
}

CONFIDENCE_MULTIPLIERS: dict[str, float] = {
    "HIGH":   1.0,
    "MEDIUM": 0.6,
    "LOW":    0.3,
    "NULL":   0.1,
}


# ---------------------------------------------------------------------------
# Electorate-level context accumulator
# (tracks rolling sentiment across a pipeline run for multi-record analysis)
# ---------------------------------------------------------------------------

@dataclass
class ElectorateContext:
    electorate: str
    event_count:      int   = 0
    sentiment_sum:    float = 0.0
    negative_events:  int   = 0
    project_events:   int   = 0
    history:          list[float] = field(default_factory=list)

    VULNERABILITY_THRESHOLD: ClassVar[int] = 3  # Hegarty Rule trigger count

    @property
    def avg_sentiment(self) -> float:
        return self.sentiment_sum / self.event_count if self.event_count else 0.0

    @property
    def is_vulnerable(self) -> bool:
        """
        Classic Hegarty vulnerability check:
        negative events >= threshold AND at least one project commissioning.
        """
        return (
            self.negative_events >= self.VULNERABILITY_THRESHOLD
            and self.project_events >= 1
        )


# ---------------------------------------------------------------------------
# Scorer
# ---------------------------------------------------------------------------

class HegartyScoringEngine:
    """
    Stateful scoring engine.  Call score_record() per item; the engine
    accumulates electorate-level context automatically.
    """

    def __init__(self) -> None:
        self._context: dict[str, ElectorateContext] = {}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_context(self, electorate: str) -> ElectorateContext:
        if electorate not in self._context:
            self._context[electorate] = ElectorateContext(electorate=electorate)
        return self._context[electorate]

    def _build_reasoning(
        self,
        record: IntelligenceRecord,
        raw_score: float,
        ctx: ElectorateContext,
    ) -> str:
        lines = [
            f"Sentiment component:  {SENTIMENT_WEIGHT} × {record.sentiment_score:.3f}",
            f"Event modifier:       {EVENT_WEIGHT} × {EVENT_MODIFIERS.get(record.event_type, 0.0):.2f} "
            f"(event_type={record.event_type})",
            f"Confidence adj:       {CONFIDENCE_WEIGHT} × {CONFIDENCE_MULTIPLIERS.get(record.confidence_level, 0.1):.2f} "
            f"(confidence={record.confidence_level})",
            f"Raw Hegarty score:    {raw_score:.4f}",
            f"Electorate context:   events={ctx.event_count}, "
            f"negative={ctx.negative_events}, projects={ctx.project_events}",
            f"Vulnerability flag:   {ctx.is_vulnerable}",
        ]
        return " | ".join(lines)

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def score_record(self, record: IntelligenceRecord) -> HegartyScoredRecord:
        electorate = record.entities.electorate
        ctx        = self._get_context(electorate)

        # --- update context ---
        ctx.event_count   += 1
        ctx.sentiment_sum += record.sentiment_score
        ctx.history.append(record.sentiment_score)

        if record.sentiment_score < -0.2:
            ctx.negative_events += 1
        if record.event_type == "PROJECT_COMMISSIONING":
            ctx.project_events += 1

        # --- compute score ---
        event_mod   = EVENT_MODIFIERS.get(record.event_type, 0.0)
        conf_mult   = CONFIDENCE_MULTIPLIERS.get(record.confidence_level, 0.1)

        raw_score = (
            SENTIMENT_WEIGHT * record.sentiment_score
            + EVENT_WEIGHT   * event_mod
            + CONFIDENCE_WEIGHT * conf_mult * record.sentiment_score
        )

        # Apply vulnerability penalty (amplifies negative scores)
        if ctx.is_vulnerable:
            raw_score = raw_score * 1.5
            logger.info(
                "Vulnerability amplifier applied for electorate %s", electorate
            )

        shift_flag = abs(raw_score) >= SHIFT_THRESHOLD

        reasoning = self._build_reasoning(record, raw_score, ctx)

        if shift_flag:
            logger.warning(
                "SHIFT FLAG raised for %s / %s — score=%.4f",
                record.entities.candidate_name,
                electorate,
                raw_score,
            )

        return HegartyScoredRecord(
            **record.model_dump(),
            hegarty_score=round(raw_score, 4),
            shift_flag=shift_flag,
            reasoning=reasoning,
        )

    def score_batch(
        self, records: list[IntelligenceRecord]
    ) -> list[HegartyScoredRecord]:
        return [self.score_record(r) for r in records]

    @property
    def electorate_contexts(self) -> dict[str, ElectorateContext]:
        return dict(self._context)
