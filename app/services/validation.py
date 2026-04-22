"""
Validation Layer
----------------
Validates and sanitises HegartyScoredRecord objects before they are
returned to the caller.  Provides a strict mode (raises on any violation)
and a lenient mode (logs warnings and coerces where possible).
"""

from __future__ import annotations

from pydantic import ValidationError

from app.models.schemas import HegartyScoredRecord, IntelligenceRecord
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ValidationError_(Exception):
    """Pipeline-specific validation failure."""


# ---------------------------------------------------------------------------
# Field-level rules
# ---------------------------------------------------------------------------

REQUIRED_NON_NULL_FIELDS = ["event_type", "source"]   # everything else can be NULL


def _check_required_fields(record_dict: dict, strict: bool) -> list[str]:
    """Return a list of violation messages."""
    violations = []
    for field in REQUIRED_NON_NULL_FIELDS:
        if record_dict.get(field, "NULL") == "NULL":
            msg = f"Required field '{field}' is NULL."
            violations.append(msg)
            if strict:
                raise ValidationError_(msg)
    return violations


def _coerce_null_strings(record_dict: dict) -> dict:
    """Replace Python None with the string 'NULL' throughout the nested dict."""
    for key, value in record_dict.items():
        if value is None:
            record_dict[key] = "NULL"
        elif isinstance(value, dict):
            record_dict[key] = _coerce_null_strings(value)
    return record_dict


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_record(
    record: HegartyScoredRecord | IntelligenceRecord,
    strict: bool = False,
) -> tuple[HegartyScoredRecord | None, list[str]]:
    """
    Validate a single record.

    Returns:
        (validated_record_or_None, list_of_warning_strings)
    In strict mode, raises ValidationError_ instead of returning None.
    """
    warnings: list[str] = []

    try:
        data = _coerce_null_strings(record.model_dump())
        violations = _check_required_fields(data, strict)
        warnings.extend(violations)

        # Re-parse through Pydantic to enforce type coercions
        if isinstance(record, HegartyScoredRecord):
            validated = HegartyScoredRecord(**data)
        else:
            validated = IntelligenceRecord(**data)

        if warnings:
            logger.warning("Record passed with warnings: %s", "; ".join(warnings))

        return validated, warnings

    except ValidationError as exc:
        msg = f"Pydantic validation error: {exc}"
        logger.error(msg)
        if strict:
            raise ValidationError_(msg) from exc
        return None, [msg]

    except ValidationError_ as exc:
        logger.error("Strict validation failed: %s", exc)
        raise


def validate_batch(
    records: list[HegartyScoredRecord],
    strict: bool = False,
) -> tuple[list[HegartyScoredRecord], list[str]]:
    """
    Validate a list of records.
    Returns (valid_records, all_warning_strings).
    Invalid records are dropped (unless strict=True, which raises).
    """
    valid:    list[HegartyScoredRecord] = []
    all_msgs: list[str] = []

    for i, record in enumerate(records):
        validated, msgs = validate_record(record, strict=strict)
        all_msgs.extend([f"[record {i}] {m}" for m in msgs])
        if validated is not None:
            valid.append(validated)
        else:
            all_msgs.append(f"[record {i}] Dropped: failed validation.")

    logger.info(
        "Validation complete: %d/%d records passed.", len(valid), len(records)
    )
    return valid, all_msgs
