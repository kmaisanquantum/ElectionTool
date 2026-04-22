"""
Ingestion Service
-----------------
Fetches RSS feeds and raw web pages. Implements exponential-backoff retry,
timeout handling, and per-source error isolation so one bad feed never
blocks the rest of the pipeline.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any
from xml.etree import ElementTree

import httpx

from app.models.schemas import FeedSource
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEFAULT_TIMEOUT = 15.0          # seconds per request
MAX_RETRIES     = 3
BACKOFF_BASE    = 1.5           # seconds; multiplied by attempt number


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_rss(xml_text: str, max_items: int) -> list[dict]:
    """Parse an RSS 2.0 / Atom feed and return a list of raw item dicts."""
    items: list[dict] = []
    try:
        root = ElementTree.fromstring(xml_text)
        # RSS 2.0
        channel = root.find("channel")
        entries = (channel or root).findall("item")
        # Atom fallback
        if not entries:
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            entries = root.findall("atom:entry", ns)

        for entry in entries[:max_items]:
            item: dict[str, Any] = {}
            for child in entry:
                tag = child.tag.split("}")[-1]   # strip namespace
                item[tag] = (child.text or "").strip()
            items.append(item)
    except ElementTree.ParseError as exc:
        logger.warning("RSS parse error: %s", exc)
    return items


def _parse_html_fallback(html: str) -> list[dict]:
    """Very lightweight fallback: extract paragraphs from raw HTML."""
    import re
    paras = re.findall(r"<p[^>]*>(.*?)</p>", html, re.DOTALL | re.IGNORECASE)
    clean = [re.sub(r"<[^>]+>", "", p).strip() for p in paras if p.strip()]
    return [{"text": p} for p in clean[:20]]


# ---------------------------------------------------------------------------
# Core fetch
# ---------------------------------------------------------------------------

async def fetch_source(
    client: httpx.AsyncClient,
    source: FeedSource,
) -> tuple[list[dict], str | None]:
    """
    Fetch a single source with retry.
    Returns (items, error_message_or_None).
    """
    url      = source.url
    attempt  = 0
    last_err = None

    while attempt < MAX_RETRIES:
        attempt += 1
        try:
            logger.info("Fetching %s (attempt %d/%d)", url, attempt, MAX_RETRIES)
            response = await client.get(url, timeout=DEFAULT_TIMEOUT, follow_redirects=True)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            body = response.text

            if "xml" in content_type or "rss" in content_type or body.lstrip().startswith("<"):
                items = _parse_rss(body, source.max_items)
                if items:
                    return items, None
                # RSS parse yielded nothing — try HTML fallback
            items = _parse_html_fallback(body)[: source.max_items]
            return items, None

        except httpx.TimeoutException:
            last_err = f"Timeout on attempt {attempt} for {url}"
            logger.warning(last_err)
        except httpx.HTTPStatusError as exc:
            last_err = f"HTTP {exc.response.status_code} for {url}"
            logger.warning(last_err)
            break  # Don't retry 4xx errors
        except Exception as exc:                    # noqa: BLE001
            last_err = f"Unexpected error for {url}: {exc}"
            logger.exception(last_err)
            break

        # Exponential backoff before retry
        await asyncio.sleep(BACKOFF_BASE * attempt)

    return [], last_err or "Unknown fetch error"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def ingest_sources(
    sources: list[FeedSource],
) -> tuple[list[dict], list[str]]:
    """
    Concurrently fetch all sources.
    Returns (all_raw_items, list_of_error_strings).
    """
    all_items: list[dict] = []
    errors:    list[str]  = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
    ) as client:
        tasks = [fetch_source(client, src) for src in sources]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    for (items, err), src in zip(results, sources):
        label = src.label or src.url
        if err:
            errors.append(f"[{label}] {err}")
            logger.error("Ingestion failed for %s: %s", label, err)
        else:
            # Tag each item with its source
            for item in items:
                item["_source_url"]   = src.url
                item["_source_label"] = label
                item["_fetched_at"]   = time.time()
            all_items.extend(items)
            logger.info("Ingested %d items from %s", len(items), label)

    return all_items, errors
