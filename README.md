# PNG Electoral Intelligence Pipeline

An automated data aggregation and scoring pipeline for Papua New Guinea political and electoral intelligence, built with FastAPI and powered by the Anthropic Claude API.

## Features

- **Ingestion** — Concurrent RSS/web fetching with exponential-backoff retry and per-source error isolation
- **Normalization** — LLM-assisted entity extraction (candidate, electorate, party) with rule-based fallback
- **Hegarty Rule Scoring** — Composite electoral-shift indicator with electorate-level vulnerability detection
- **Validation** — Strict/lenient output validation with NULL-coercion and Pydantic enforcement
- **React Dashboard** — Live intelligence terminal UI with charts, detail panels, and Anthropic API analyst queries

## Project Structure

```
png-electoral-intelligence/
├── app/
│   ├── main.py                    # FastAPI entrypoint
│   ├── models/
│   │   └── schemas.py             # Pydantic schema definitions
│   ├── routers/
│   │   ├── health.py              # GET /health
│   │   ├── ingest.py              # POST /ingest
│   │   └── pipeline.py            # POST /pipeline/run
│   ├── services/
│   │   ├── ingestion.py           # RSS/web fetching
│   │   ├── normalization.py       # LLM + rule-based NER
│   │   ├── scoring.py             # Hegarty Rule engine
│   │   └── validation.py          # Output validation layer
│   └── utils/
│       └── logger.py
├── dashboard/
│   └── png_electoral_dashboard.jsx  # React intelligence dashboard
├── tests/
│   └── test_pipeline.py           # 16 tests (pytest)
├── requirements.txt
├── pytest.ini
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 3. Run the full pipeline

```bash
curl -X POST http://localhost:8000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {
        "url": "https://rnz.co.nz/rss/pacific.xml",
        "label": "RNZ Pacific",
        "max_items": 20
      }
    ]
  }'
```

#### Query parameters

| Param     | Default | Description                                              |
|-----------|---------|----------------------------------------------------------|
| `use_llm` | `true`  | Use Claude API for normalization (falls back to rules)   |
| `strict`  | `false` | Raise on validation failure instead of dropping record   |

### 4. Run tests

```bash
pytest tests/ -v
```

---

## Output Schema

```json
{
  "event_type": "string",
  "source": "string",
  "entities": {
    "candidate_name": "string",
    "electorate": "string",
    "party_affiliation": "string"
  },
  "sentiment_score": "float (-1.0 to 1.0)",
  "confidence_level": "HIGH | MEDIUM | LOW | NULL",
  "hegarty_score": "float",
  "shift_flag": "boolean",
  "reasoning": "string"
}
```

Missing fields resolve to `"NULL"` — never hallucinated.

---

## Hegarty Rule

The Hegarty Rule is a composite electoral-shift indicator adapted for PNG's Limited Preferential Voting (LPV) system:

```
hegarty_score = (0.50 × sentiment_score)
              + (0.35 × event_type_modifier)
              + (0.15 × confidence_multiplier × sentiment_score)
```

**Event type modifiers:**

| Event Type             | Modifier |
|------------------------|----------|
| ELECTORAL_RESULT       | +1.00    |
| PROJECT_COMMISSIONING  | +0.60    |
| POLICY_STATEMENT       | +0.10    |
| GENERAL_POLITICAL      |  0.00    |
| ALLIANCE_FORMATION     | -0.20    |
| CANDIDATE_ANNOUNCEMENT | -0.30    |
| VOTING_IRREGULARITY    | -0.80    |

**Vulnerability amplifier:** When an electorate accumulates ≥3 negative events AND ≥1 PROJECT_COMMISSIONING, all subsequent scores are multiplied by 1.5×.

**Shift flag:** Triggered when `|hegarty_score| ≥ 0.40`.

---

## Dashboard

The React dashboard (`dashboard/png_electoral_dashboard.jsx`) is a self-contained component:

- **Records tab** — Filterable record list, detail panel with radar chart, shift alert sidebar
- **Chart View** — Hegarty and sentiment bar charts by electorate
- **Live Analyst** — Queries Claude API with the full records payload for real-time electoral analysis

To use the dashboard, copy `png_electoral_dashboard.jsx` into any React project and import it as the default export. No props required.

---

## Environment

The Anthropic API key is handled by the hosting environment (Claude.ai artifacts or your own proxy). For local development, set:

```bash
export ANTHROPIC_API_KEY=your_key_here
```

And update the fetch headers in `normalization.py` and the dashboard accordingly.

---

## License

MIT
