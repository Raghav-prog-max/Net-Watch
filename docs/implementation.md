# NetWatch Implementation & Workflow (Innovate 2026)

This document defines the 8-step build process to go from an empty environment to a fully deployed ML pipeline, Backend API, and Frontend Dashboard for the **Microsoft Innovate 2026** pitch.

Each step aligns with the project handbook's Definition of Done and utilizes the comprehensive `Makefile`.

## Step 0 — Repo & Environment Setup (Day 1)
- Run `make venv` to create the Python 3.11 virtual environment and install `requirements.txt`.
- The `Makefile` is configured to automatically use the `.venv` Python executable for all subsequent targets.
- **Done when:** The `.venv` folder exists and `pip install` has completed successfully.

## Step 1 — Real or Synthetic Data (Day 1–2)
- **Fast Path (Synthetic):** Run `make synthetic` to generate 60k rows of fake traffic.
- **Real Data (CICIDS2017):** Run `python scripts/download_data.py` to pull data from Kaggle into `data/raw/`.
- Run `make data` to clean the CSVs into `data/processed/flows.pkl`.
- **Done when:** `data/processed/flows.pkl` exists.

## Step 2 — Model Training & Evaluation (Day 2–5)
- Run `make train` (or `make quick` to skip LOFO). This trains the LightGBM classifier and the Isolation Forest anomaly detector.
- Run `make evaluate` to regenerate `docs/model_card.md` using the latest metrics.
- **Done when:** `models/v1/` contains the `.joblib` artifacts and `reports/metrics.json` is generated. The model card reflects accurate precision, recall, and PR-AUC per class.

## Step 3 — Service & Replayer (Day 4–6)
- Run `make api` to launch the FastAPI server (accessible at `localhost:8000`).
- Run `make demo` in a separate terminal to start streaming known attack scenarios using `replay/replayer.py`.
- **Done when:** Alerts appear in `data/alerts.db` and the API serves them over `/alerts`.

## Step 4 — SOC Dashboard (Day 3–8)
- In the `dashboard/` folder, run `npm install` and `npm run dev`.
- **Done when:** The frontend loads at `localhost:3000` and live alerts populate over WebSockets. (Tag R / Raghav's domain).

## Step 5 — Drift Monitoring (Day 8–10)
- Run `python replay/replayer.py --scenario drift`.
- The `ml/drift/monitor.py` runs KS tests, tracks Population Stability Index (PSI), and applies alert-rate Warning (1.5x) and Drift (2x) thresholds.
- **Done when:** The dashboard's Drift page updates from `stable` to `warning` or `drift`, highlighting top drifting features.

## Step 6 — Feedback Loop & Retraining (Day 10–12)
- Analysts mark alerts with `false_positive` or provide ground-truth families on the dashboard.
- Run `make retrain` to extract those labeled alerts from the DB, combine them with the base training data, and output a new model to `models/v2/`.
- **Done when:** `make retrain` completes and the CLI script recommends whether to promote `v2` based on macro-F1 improvements and the FPR budget.

## Step 7 — Offline Demo prep (Day 12–14)
- Run `make seed` to pre-populate the SQLite DB with 80 alerts without needing to run the live replayer during the presentation.
- Run `make holdout` to prepare `models/v1-without-webattack/` for the novel attack demo scenario.
- **Done when:** The pitch deck is finalized and the backup video is recorded.
