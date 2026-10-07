# NetWatch (Microsoft Innovate 2026)

[![CI](https://github.com/Raghav-prog-max/Net-Watch/actions/workflows/ci.yml/badge.svg)](https://github.com/Raghav-prog-max/Net-Watch/actions/workflows/ci.yml)

NetWatch is an ML-powered network intrusion detection system designed to surface high-fidelity alerts to a SOC analyst. It leverages a two-pronged approach:
1. A **LightGBM Classifier** to detect known attack families (DDoS, Botnet, BruteForce, etc.).
2. An **Isolation Forest Anomaly Detector**, trained exclusively on benign traffic, to catch novel zero-day attacks the classifier has never seen.

Nothing in this repository blocks traffic. The system operates passively, analyzing network flows and presenting triaged alerts.

---

## 🚀 Quick Start

See **[`HOW_TO_RUN.md`](HOW_TO_RUN.md)** for detailed, step-by-step instructions on setting up the virtual environment, generating data, and launching the API and Dashboard.

## 📖 Documentation

All extensive documentation and architectural explanations have been moved to the `docs/` folder to keep the root clean.

| Document | Description |
|---|---|
| [`docs/DATA_SETUP.md`](docs/DATA_SETUP.md) | Instructions for downloading and verifying the real CICIDS2017 files. |
| [`docs/CODE_TOUR.md`](docs/CODE_TOUR.md) | Understanding why each module does what it does. |
| [`docs/evaluation.md`](docs/evaluation.md) | ML evaluation methodology (Metrics, LOFO, Thresholds). |
| [`docs/drift_strategy.md`](docs/drift_strategy.md) | Drift monitoring strategy (PSI, KS Test, Alert-rate logic). |
| [`docs/model_card.md`](docs/model_card.md) | Auto-generated Model Card containing performance metrics. |
| [`docs/demo_script.md`](docs/demo_script.md) | The 3-minute demo, step by step, with the commands and what to point at. |

## 📂 Repository Structure

| Path | Role |
|---|---|
| `ml/data/` | Loading, cleaning, label family mapping, leakage-free time-block splits. |
| `ml/models/` | The LightGBM classifier, Isolation Forest anomaly detector, and `combine.py` for decision logic. |
| `ml/evaluate/` | Logic for per-class metrics, PR/ROC-AUC, FPR, threshold choice, and LOFO tests. |
| `ml/drift/` | Monitors PSI per feature, KS tests, and evaluates overall drift status. |
| `api/` | The FastAPI scoring service, SQLite alert store, and WebSocket feed. |
| `replay/` | Replays held-out flows (known, novel, drift scenarios) to simulate live traffic for demos. |
| `dashboard/` | Next.js SOC UI. |
| `scripts/` | Utilities for dataset download, DB seeding, synthetic data generation, and feedback-based retraining. |
| `tests/` | Exhaustive `pytest` suite ensuring pipeline integrity. |

## 🛡️ Core Principles

1. **No random train/test split.** Flows are grouped into 5-minute blocks; tests fail the build if a block lands in two splits.
2. **No bare accuracy.** Reports carry per-class precision and recall, PR-AUC, and false alerts per 10,000 benign flows.
3. **FPR Budgeting.** The alert threshold comes from a strict false-positive budget (e.g., 0.5%), not from an arbitrary 0.5 probability.
4. **Zero-Day testing.** Rare families (e.g., Infiltration, Heartbleed) are never trained on. They serve purely as test material for the anomaly detector.
5. **Passive Analysis.** No code path blocks, drops, or rate-limits live traffic.
