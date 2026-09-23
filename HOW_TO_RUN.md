# How to Run NetWatch

Welcome to the NetWatch project! This guide will walk you through initializing your environment, downloading the data, and spinning up the full ML pipeline, backend API, and frontend SOC dashboard.

---

## 1. Environment Setup

We have provided convenient setup scripts to automatically construct your Python virtual environment and install all necessary dependencies.

**For Windows (PowerShell):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
```

**For Linux / macOS (Bash):**
```bash
bash setup.sh
```
> [!NOTE]
> This creates a local `.venv` folder in the project root and installs everything from `requirements.txt`.

---

## 2. Running Commands

You can activate the virtual environment manually (e.g. `.\.venv\Scripts\Activate.ps1` or `source .venv/bin/activate`), but we've also provided a handy `run` script wrapper that executes commands directly inside the environment:

**Windows:**
```powershell
.\run.ps1 ml\train.py
.\run.ps1 -m pytest tests\
```

**Linux / macOS:**
```bash
./run.sh python ml/train.py
./run.sh pytest tests/
```

Alternatively, you can just use the provided `Makefile` which is already wired up to the project!

---

## 3. Data & Training Pipeline

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
   Process the raw CSVs into a cleaned pickle file, and train both the LightGBM classifier and the Isolation Forest anomaly detector.
   ```bash
   make data
   make train
   ```
   > [!TIP]
   > The models and reference stats will be saved to `models/v1/` and the evaluation metrics to `reports/metrics.json`.

---

## 4. Spin Up the System

Once your models are trained, you can bring up the NetWatch API and Dashboard! Open three separate terminals.

**Terminal 1: Start the Scoring API**
The API provides endpoints and WebSockets for the UI.
```bash
make api
```
*(Available at `http://localhost:8000/docs`)*

**Terminal 2: Replay Traffic**
The replayer acts like a network tap, continuously streaming held-out flows into the API to simulate live traffic.
```bash
python replay/replayer.py --scenario novel --rate 60
```

**Terminal 3: Start the SOC Dashboard**
Boot up the frontend UI to watch the alerts roll in.
```bash
cd dashboard
npm install
npm run dev
```
*(Available at `http://localhost:3000`)*

---

### Verifying the Setup
If everything is working correctly, you should see the replayer terminal printing "Sent flow..." messages, and your Dashboard at `http://localhost:3000` should start lighting up with incoming network flows and alerts!
