# ==============================================================================
# NetWatch AI SOC — Production Architecture & Topology
# ==============================================================================

This document describes the high-availability topology, data flows, and infrastructure components of NetWatch in production.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    Client["Client Browsers / SOC Analysts"]
    Sensor["Network Tap / Flow Sensors"]

    subgraph Edge["Perimeter & Load Balancing"]
        Nginx["Nginx Reverse Proxy, optional TLS (Port 80/443)"]
    end

    subgraph Application["Application Layer (Internal Network)"]
        Dashboard["Next.js 16 Dashboard (Port 3000)"]
        API["FastAPI Inference Engine (Port 8000)"]
        WorkerPool["One Uvicorn Worker (state lives in the process)"]
    end

    subgraph Engines["ML Scoring Engines"]
        LightGBM["Supervised Classifier (LightGBM)"]
        IsoForest["Unsupervised Anomaly (Isolation Forest)"]
        TreeSHAP["TreeSHAP Explainer Engine"]
        MitreMap["MITRE ATT&CK Mapper"]
    end

    subgraph Data["Persistence & Storage Layer"]
        AlertDB[("SQLite Alert Store (netwatch-db-data volume)")]
        ModelStore["models/ from the repository (models/ACTIVE picks the version)"]
        ReportsStore["reports/ from the repository"]
    end

    Sensor -->|POST /api/score| Nginx
    Client -->|HTTPS & WSS| Nginx

    Nginx -->|every path but /api| Dashboard
    Nginx -->|/api/... prefix stripped| API
    Nginx -->|/api/ws/alerts WebSocket| API

    API --> WorkerPool
    WorkerPool --> LightGBM
    WorkerPool --> IsoForest
    WorkerPool --> TreeSHAP
    WorkerPool --> MitreMap

    API --> AlertDB
    API --> ModelStore
    API --> ReportsStore
```

---

## 2. Component Directory

| Component | Technology | Role in Production | Concurrency / Scaling |
|:---|:---|:---|:---|
| **Reverse Proxy** | Nginx 1.25 Alpine | Routing (`/api` to the API, the rest to the dashboard), TLS and HTTP/2 with `NGINX_SITE=https`, WebSockets, rate limiting | Multi-worker epoll event loop |
| **Backend API** | FastAPI + Python 3.11 | ML inference, drift tracking, alert persistence, WS broadcasting | **One** Uvicorn worker: the drift window, alert grouping and WebSocket connections live in the process, so more workers would each see a share of the traffic. Scale up, not out. |
| **SOC Dashboard** | Next.js 16 + React 18 | Interactive SOC triage, 3D visualization, MITRE telemetry | Node.js cluster / multi-instance |
| **Supervised Classifier** | LightGBM | Multiclass attack family identification with calibrated probabilities | CPU OpenMP thread-parallel |
| **Anomaly Detector** | Isolation Forest | Unsupervised novel attack detection against benign envelope | Pre-fitted tree estimators |
| **Explainability** | TreeSHAP | Feature attribution values for top contributing flow features | TreePath caching |
| **Database** | SQLite | Alert history, analyst triage labels, escalation tracking | One writer (the API) |

---

## 3. Data Flow: Flow Ingestion to Live SOC Alert

1. **Ingestion**: Network sensors post batches of flows to `POST /api/score` (`{"flows": [{"features": {...}}]}`).
2. **Feature Preparation**: Features are aligned against the trained 30-feature schema; non-feature identifiers (`Flow ID`, IP addresses) are safely stripped.
3. **Dual-Engine Evaluation**:
   - LightGBM predicts attack family probability distribution.
   - Isolation Forest computes normalized anomaly score.
4. **Decision Boundary**: The combined scorer evaluates whether the flow exceeds the budget threshold (e.g., $\le 50$ false alerts per 10k flows).
5. **Enrichment**:
   - Alerts generate TreeSHAP explanations.
   - Attributed features map to MITRE ATT&CK techniques and recommended actions.
6. **Persistence & Broadcast**:
   - The alert is committed to `netwatch.db`.
   - The alert payload broadcasts via the WebSocket (`/api/ws/alerts` through nginx) to connected analyst consoles.
