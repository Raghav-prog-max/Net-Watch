# How to Run NetWatch

Welcome to NetWatch! This guide walks you through setting up the environment, preparing the data, and spinning up the full ML pipeline, backend API, and SOC dashboard.

---

## 1. Environment Setup

We strongly recommend using the provided `Makefile` which automates environment creation and target execution.

Create your virtual environment and install all dependencies:
```bash
make venv
```
> [!NOTE]
> This creates a local `.venv` folder in the project root and installs everything from `requirements.txt`. All `make` commands will automatically detect and use this environment.

---

## 2. Data & Training Pipeline

To get the system running, you need data and trained models.

1. **Generate Synthetic Traffic (Quick Start)**
   If you want to test the plumbing without downloading the massive real dataset:
   ```bash
   make synthetic
   ```
2. **Download Real Data (Optional)**
   We use the Kaggle API to pull the real CICIDS2017 dataset. Make sure your `kaggle.json` credentials are set up.
   ```bash
   python scripts/download_data.py
   ```
3. **Process & Train**
   Clean the raw CSVs into a `.pkl` file, train the LightGBM classifier and the Isolation Forest anomaly detector, and generate the evaluation metrics.
   ```bash
   make data
   make train
   make evaluate
   ```
   > [!TIP]
   > The models and reference stats are saved to `models/v1/`, the metrics to `reports/metrics.json`, and the Model Card to `docs/model_card.md`.

---

## 3. Spin Up the System

Once your models are trained, open three separate terminals to bring up the full system.

**Terminal 1: Start the Scoring API**
The FastAPI server provides REST endpoints and WebSockets for the UI.
```bash
make api
```
*(Available at `http://localhost:8000/docs`)*

**Terminal 2: Replay Traffic**
The replayer acts like a network tap, continuously streaming held-out flows into the API to simulate live traffic.
```bash
make demo
```
*(You can also run specific scenarios: `python replay/replayer.py --scenario drift`)*

**Terminal 3: Start the SOC Dashboard**
Boot up the frontend UI to watch the alerts roll in.
```bash
make dashboard
```
*(Available at `http://localhost:3000`)*

---

## 4. Offline Demo Mode

If you need to demo the dashboard without the live replayer streaming traffic, you can pre-seed the database:
```bash
make seed
```
This populates the SQLite database with generated alerts so the dashboard looks active immediately.

---

## 5. Testing

To run the complete suite of tests (API, ML pipeline, Drift logic, etc.):
```bash
make test
```

### Checking the metrics code on NSL-KDD (optional)

`make nslkdd` trains a quick Random Forest on NSL-KDD and recomputes every number
in `ml/evaluate/metrics.py` a second way (from raw counts and ranks); it fails if
any of them disagree. It needs `KDDTrain+.txt` and `KDDTest+.txt` in
`data/raw/nsl-kdd/` — not in the repository, fetch them yourself. The result goes to
`reports/nslkdd_check.json`. The tests already run the same check on a small
fixture, so CI covers the code without the dataset.

### Exploratory analysis notebook (optional)

```bash
pip install -r requirements-dev.txt
make eda
```
Re-runs `ml/notebooks/eda.ipynb` on whatever is in `data/processed/`.

---

## 6. Without `make` (plain Windows)

Windows does not ship `make`. Every target is one command; run them from the
repository root with the virtual environment's Python:

| Make target | Command |
|---|---|
| `make venv` | `python -m venv .venv` then `.venv\Scripts\python -m pip install -r requirements.txt` |
| `make synthetic` | `.venv\Scripts\python scripts/make_synthetic.py --rows 60000` |
| `make data` | `.venv\Scripts\python -m ml.prepare --config ml/config.yaml` |
| `make train` | `.venv\Scripts\python -m ml.train --config ml/config.yaml` |
| `make evaluate` | `.venv\Scripts\python -m ml.evaluate.model_card` |
| `make api` | `.venv\Scripts\python -m uvicorn api.main:app --port 8000` |
| `make demo` | `.venv\Scripts\python replay/replayer.py --scenario known --rate 60` |
| `make dashboard` | `cd dashboard && npm install && npm run dev` |
| `make seed` | `.venv\Scripts\python scripts/seed_db.py --count 80 --scenario known` |
| `make retrain` | `.venv\Scripts\python scripts/retrain.py --out models/v2` |
| `make test` | `.venv\Scripts\python -m pytest -q` |
| `make nslkdd` | `.venv\Scripts\python scripts/nslkdd_check.py` |
| `make eda` | `.venv\Scripts\python -m nbconvert --to notebook --execute --inplace ml/notebooks/eda.ipynb` |

Use `http://127.0.0.1:8000`, not `localhost`, if you point anything at the API
by hand: on Windows `localhost` tries IPv6 first and each request waits ~2 s.

Or run the whole stack in Docker: `docker compose up` (train the models first;
the API reads `models/v1/` from the repository folder).
