# NetWatch Backend Architecture (Tag D)

This document outlines the architecture, components, and endpoints implemented for the NetWatch backend. The implementation perfectly conforms to the **Microsoft Innovate 2026: Project Handbook** specification for the backend team (Tag D).

## Architecture & Framework
- **Framework**: FastAPI (Python 3.11)
- **Database**: SQLite with SQLAlchemy ORM (JSON column support for nested schemas)
- **Real-time**: WebSockets for live alert streaming
- **Schema Validation**: Pydantic V2

## Directory Structure
```text
api/
├── main.py                     # App entrypoint and CORS configuration
├── db/
│   ├── models.py               # SQLAlchemy SQLite models (AlertModel)
│   └── session.py              # DB connection and session maker
├── routes/
│   ├── alerts.py               # GET/PATCH routes for alerts
│   ├── metrics.py              # GET routes for metrics and models
│   ├── score.py                # POST route for traffic ingestion and scoring
│   └── ws.py                   # WebSocket connection manager
├── services/
│   ├── mitre.py                # Integrated with existing ML mitre mapper
│   ├── scorer.py               # Loads models/v1 and scores flows with the trained models
│   └── drift_service.py        # Centralized drift logic (PSI + KS test + Alert Rate limits)
└── schemas.py                  # Frozen Pydantic contracts for Flow, Alert, Feedback
```

## API Contract (Verified against Handbook)
The API strictly fulfills the frozen Day 2 API contract:

### Scoring & Flow Ingestion
- `POST /score`
  - Purpose: Score one flow or a batch; returns alerts created.
  - Request: `{"flows": [{"features": {"Flow Duration": 1234.0, ...}, "meta": {"src_ip": "10.0.0.5"}}]}`.
    `features` are CIC-IDS2017 columns fed to the models (missing ones score as 0.0);
    `meta` is optional and display-only. The replayer sends features only.
  - The alert's `flow` is the handbook's flow facts, read off the features (`flow_facts` in
    `api/services/scorer.py`): `dst_port` (Destination Port), `protocol` (Protocol: 6 TCP,
    17 UDP, 1 ICMP), `duration_ms` (Flow Duration, which is in microseconds), `fwd_packets`
    and `bwd_packets`. A fact the data lacks is left out, not null (the synthetic data has
    no Protocol). `meta` can supply or override them and add others such as IPs; a
    ground-truth label (`truth`, `label`, `family`) is dropped, never shown to the analyst.
  - Response: `{"scored": <flows received>, "alerted": <flows that raised an alert>, "alerts": [Alert, ...]}`;
    benign flows produce no alert. `alerted / scored` is the alert rate; `alerts` is shorter (see grouping).
  - Grouping (not in the handbook; added so a burst is one row, not thousands):
    a flow joins the alert of its family when that alert is still `open` and last grew under
    60 s ago; `flow_count` says how many flows it holds. Once an analyst acknowledges,
    escalates, dismisses or resolves it, the next flow opens a new alert. The alert shows its
    most severe flow (severity, explanation, MITRE, flow facts), keeps the model inputs of up
    to 100 flows for `scripts/retrain.py`, and is re-sent over the WebSocket as stored at most
    every 5 s while it grows. Constants at the top of `api/routes/score.py`.
  - Integration: Runs the trained models from `models/v1`. LightGBM classifier, Isolation Forest, and the family novelty check, combined by `ml/models/combine.py`; SHAP explanations; persists alerts and broadcasts over WebSocket.
    Returns 503 until `make train` has produced the models.

### Alerts
- `GET /alerts`
  - Purpose: Paginated alert list. Query Params: `severity`, `status`, `family`, `page`, `size`.
- `GET /alerts/{id}`
  - Purpose: Fetch alert detail with explanation.
- `PATCH /alerts/{id}`
  - Purpose: Triage alerts. Accepts `status`, `analyst_label`, and `analyst_note`.

### Metrics & ML Metadata
- `GET /metrics/model`
  - Purpose: Evaluation report JSON: `reports/metrics.json` from `make train`.
- `GET /metrics/drift`
  - Purpose: Live drift status from the scorer's window of benign-looking flows. Uses `api/services/drift_service.py` to evaluate Population Stability Index (PSI), KS test on top features, and alert rate thresholds.
- `GET /models`
  - Purpose: Active model thresholds, triage counts, and `docs/model_card.md`.

### Real-Time Streaming
- `WS /ws/alerts`
  - Purpose: Live stream of new alerts as they are created via `POST /score`, and of growing
    alerts re-sent with their new `flow_count` (same `id`: replace, don't append).

## Testing Suite
An exhaustive test suite is located in `tests/` to guarantee structural integrity:
- **`tests/test_schema.py`**: Asserts Pydantic models against boundary conditions, missing attributes, and invalid types.
- **`tests/test_api.py`**: Fully exercises API limits, filtering permutations, invalid payload requests, pagination rules, and load testing.
- **`tests/test_scorer.py`**: Mathematically validates the severity equation against all thresholds defined in the handbook to guarantee accurate mappings.
