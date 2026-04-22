"""
Normalization Service
---------------------
Maps a raw ingested item (dict with arbitrary keys) to the structured
IntelligenceRecord schema using rule-based heuristics *plus* an optional
call to the Anthropic API for deep extraction.

Chain-of-thought reasoning is injected into the LLM prompt so the model
explains each field derivation before emitting the final JSON.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.models.schemas import EntityBlock, IntelligenceRecord
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Known PNG electorates and parties for rule-based matching
# ---------------------------------------------------------------------------

PNG_ELECTORATES: list[str] = [
    "Moresby North-East", "Moresby North-West", "Moresby South",
    "Lae Open", "Goroka Open", "Mount Hagen Open", "Madang Open",
    "Wewak Open", "Alotau Open", "Kokopo Open", "Kimbe Open",
    "Kavieng Open", "Manus Open", "Vanimo-Green Open",
    "Kairuku-Hiri Open", "Rigo Open", "Abau Open",
    "Esa'ala Open", "Kiriwina-Goodenough Open",
    # Add full 111-electorate list in production
]

PNG_PARTIES: list[str] = [
    "Pangu Party", "People's National Congress", "People's Progress Party",
    "United Resources Party", "Triumph Heritage Empowerment Party",
    "National Alliance", "PNG Party", "Our Development Party",
    "Melanesian Alliance", "Social Democratic Party",
]

EVENT_KEYWORDS: dict[str, list[str]] = {
    "CANDIDATE_ANNOUNCEMENT": ["announce", "contest", "nomination", "campaign launch"],
    "PROJECT_COMMISSIONING":  ["project", "infrastructure", "road", "bridge", "commission"],
    "VOTING_IRREGULARITY":    ["fraud", "bribery", "election offence", "irregularity"],
    "POLICY_STATEMENT":       ["policy", "pledge", "promise", "manifesto"],
    "ELECTORAL_RESULT":       ["result", "elected", "won", "count", "tally"],
    "ALLIANCE_FORMATION":     ["coalition", "alliance", "agreement", "memorandum"],
}

# ---------------------------------------------------------------------------
# Rule-based helpers
# ---------------------------------------------------------------------------

def _extract_electorate(text: str) -> str:
    for e in PNG_ELECTORATES:
        if e.lower() in text.lower():
            return e
    return "NULL"


def _extract_party(text: str) -> str:
    for p in PNG_PARTIES:
        if p.lower() in text.lower():
            return p
    return "NULL"


def _extract_event_type(text: str) -> str:
    lower = text.lower()
    for event_type, keywords in EVENT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return event_type
    return "GENERAL_POLITICAL"


def _extract_candidate_name(text: str) -> str:
    """
    Naive NER: looks for 'Hon.', 'Mr', 'Ms', 'Dr' followed by title-case words,
    or capitalised two-word proper names not in a stop-list.
    """
    patterns = [
        r"\b(?:Hon\.|Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+([A-Z][a-z]+ [A-Z][a-z]+)",
        r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b",   # generic proper name
    ]
    stop_words = {
        "Papua New", "New Guinea", "Port Moresby", "Prime Minister",
        "National Parliament",
    }
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            if match not in stop_words:
                return match
    return "NULL"


def _rule_based_normalize(raw: dict) -> IntelligenceRecord:
    """Fast path: pure regex / keyword heuristics, no API call."""
    # Concatenate all text-like fields
    text_blob = " ".join(
        str(v) for k, v in raw.items()
        if not k.startswith("_") and isinstance(v, str)
    )

    entities = EntityBlock(
        candidate_name=_extract_candidate_name(text_blob),
        electorate=_extract_electorate(text_blob),
        party_affiliation=_extract_party(text_blob),
    )

    return IntelligenceRecord(
        event_type=_extract_event_type(text_blob),
        source=raw.get("_source_label", raw.get("_source_url", "NULL")),
        entities=entities,
        sentiment_score=0.0,   # filled by extraction service
        confidence_level="LOW",
    )


# ---------------------------------------------------------------------------
# LLM-assisted normalization (Anthropic API)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are an expert analyst of Papua New Guinea electoral politics.
Given a raw news item, extract structured intelligence.

STEP-BY-STEP REASONING (think before outputting):
1. Identify the primary EVENT TYPE from: CANDIDATE_ANNOUNCEMENT, PROJECT_COMMISSIONING,
   VOTING_IRREGULARITY, POLICY_STATEMENT, ELECTORAL_RESULT, ALLIANCE_FORMATION, GENERAL_POLITICAL
2. Identify the CANDIDATE NAME (full name, or NULL)
3. Identify the ELECTORATE (PNG electorate name, or NULL)
4. Identify the PARTY AFFILIATION (or NULL)
5. Score SENTIMENT: -1.0 (very negative) to +1.0 (very positive) from the perspective of
   the named candidate. 0.0 = neutral.
6. Assign CONFIDENCE: HIGH (all fields found), MEDIUM (most fields found), LOW (few fields found)

After your reasoning, output ONLY a valid JSON object matching this schema exactly
(use string "NULL" for missing fields, not null):
{
  "event_type": "string",
  "source": "string",
  "entities": {
    "candidate_name": "string",
    "electorate": "string",
    "party_affiliation": "string"
  },
  "sentiment_score": float,
  "confidence_level": "HIGH" | "MEDIUM" | "LOW"
}
Do NOT wrap the JSON in markdown fences.
"""


async def _llm_normalize(raw: dict) -> IntelligenceRecord | None:
    """Call Anthropic API for deep extraction. Returns None on failure."""
    text_blob = " ".join(
        str(v) for k, v in raw.items()
        if not k.startswith("_") and isinstance(v, str)
    )
    if not text_blob.strip():
        return None

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1000,
        "system": _SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": (
                    f"Source: {raw.get('_source_label', 'unknown')}\n\n"
                    f"Raw item:\n{text_blob[:3000]}"
                ),
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()

        data = resp.json()
        raw_text = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )

        # Strip any accidental markdown fences
        clean = re.sub(r"```(?:json)?|```", "", raw_text).strip()
        parsed = json.loads(clean)

        record = IntelligenceRecord(
            event_type=parsed.get("event_type", "NULL"),
            source=parsed.get("source", raw.get("_source_label", "NULL")),
            entities=EntityBlock(
                candidate_name=parsed.get("entities", {}).get("candidate_name", "NULL"),
                electorate=parsed.get("entities", {}).get("electorate", "NULL"),
                party_affiliation=parsed.get("entities", {}).get("party_affiliation", "NULL"),
            ),
            sentiment_score=parsed.get("sentiment_score", 0.0),
            confidence_level=parsed.get("confidence_level", "LOW"),
        )
        return record

    except (httpx.HTTPError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("LLM normalization failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def normalize_item(
    raw: dict[str, Any],
    use_llm: bool = True,
) -> IntelligenceRecord:
    """
    Normalize a single raw item.
    If use_llm=True, attempt LLM extraction first; fall back to rule-based.
    """
    if use_llm:
        record = await _llm_normalize(raw)
        if record:
            return record
        logger.info("Falling back to rule-based normalization for item.")

    return _rule_based_normalize(raw)


async def normalize_batch(
    raw_items: list[dict],
    use_llm: bool = True,
) -> tuple[list[IntelligenceRecord], list[str]]:
    """Normalize a list of raw items; returns (records, errors)."""
    import asyncio
    records: list[IntelligenceRecord] = []
    errors:  list[str] = []

    tasks = [normalize_item(item, use_llm) for item in raw_items]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            errors.append(f"Normalization error on item {i}: {result}")
        else:
            records.append(result)

    return records, errors
