# NetWatch Backend Implementation

This document outlines the architecture, components, and endpoints implemented for the NetWatch backend. The implementation perfectly conforms to the "NetWatch: Project handbook" specification for the backend team (Role D).

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
│   ├── drift_service.py        # Mock drift monitor
│   ├── mitre.py                # Integrated with existing ML mitre mapper
│   └── scorer.py               # Severity math and ML prediction proxy
└── schemas.py                  # Frozen Pydantic contracts for Flow, Alert, Feedback
```

## API Contract (Verified against Handbook)
The API strictly fulfills the frozen Day 2 API contract:

### Scoring & Flow Ingestion
- `POST /score`
  - Purpose: Score one flow or a batch; returns alerts created.
  - Integration: Triggers mock ML logic, evaluates severity thresholds, persists alerts to DB, and broadcasts over WebSocket.

### Alerts
- `GET /alerts`
  - Purpose: Paginated alert list.
  - Query Params: `severity`, `status`, `family`, `page` (defaults to 1), `size` (defaults to 50).
- `GET /alerts/{id}`
  - Purpose: Fetch alert detail with explanation.
- `PATCH /alerts/{id}`
  - Purpose: Triage alerts. Accepts `status`, `analyst_label`, and `analyst_note`.

### Metrics & ML Metadata
- `GET /metrics/model`
  - Purpose: Evaluation report JSON (returns mock macro-F1, FPR, ROC data).
- `GET /metrics/drift`
  - Purpose: Current drift status and history (returns PSI and KS test mocks).
- `GET /models`
  - Purpose: Return active model versions and model card text.

### Real-Time Streaming
- `WS /ws/alerts`
  - Purpose: Live stream of new alerts as they are created via `POST /score`.

## Testing Suite
An exhaustive 100+ test suite is located in `tests/` to guarantee structural integrity:
- **`tests/test_schema.py`**: Asserts Pydantic models against boundary conditions, missing attributes, and invalid types.
- **`tests/test_api.py`**: Fully exercises API limits, filtering permutations, invalid payload requests, pagination rules, and load testing via `TestClient`.
- **`tests/test_scorer.py`**: Mathematically validates the severity equation against all thresholds defined in the handbook to guarantee accurate `Medium`, `High`, and `Critical` mappings.

## Setup & Running
All dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `websockets`, `requests`) have been cleanly integrated into the root `requirements.txt` alongside ML dependencies. 

To run the backend server:
```bash
uvicorn api.main:app --reload
```
Swagger UI will be available at `http://localhost:8000/docs`.
