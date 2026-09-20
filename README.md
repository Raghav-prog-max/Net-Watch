# NetWatch

ML network intrusion detection that surfaces alerts to a SOC analyst. Two models:
a classifier for known attack families, and an anomaly detector trained on benign
traffic only, which is what catches attacks the classifier has never seen.

Nothing in this repository blocks traffic.

## Quick start (no dataset needed)

```bash
pip install -r requirements.txt
make synthetic      # fake traffic, for plumbing work only
make data           # clean -> data/processed/flows.pkl
make train          # trains both models, writes models/v1 + reports/metrics.json
make test           # split-leakage test
```

Then, in two terminals:

```bash
make api                                         # http://localhost:8000/docs
python replay/replayer.py --scenario novel       # streams flows at the API
```

And the dashboard:

```bash
cd dashboard && npm install && npm run dev       # http://localhost:3000
```

## Real data

Download CICIDS2017 (the `TrafficLabelling` CSVs, which keep the Timestamp column,
or the corrected relabelling by Engelen et al. 2021) into `data/raw/`, then rerun
`make data && make train`. Set `benign_downsample` in `ml/config.yaml` if the full
dataset is too large for your machine.

## What each part does

| Path | Role |
|---|---|
| `ml/data/` | loading, cleaning, label families, leakage-free time-block splits |
| `ml/models/classifier.py` | LightGBM (or sklearn fallback) over six attack families |
| `ml/models/anomaly.py` | Isolation Forest fitted on benign traffic only |
| `ml/models/combine.py` | decision logic, severity score, MITRE mapping |
| `ml/evaluate/` | per-class metrics, PR/ROC-AUC, FPR, threshold choice, LOFO |
| `ml/drift/monitor.py` | PSI per feature, drift status, retraining recommendation |
| `api/` | FastAPI scoring service, SQLite alert store, WebSocket feed |
| `replay/replayer.py` | streams held-out flows to make the demo look live |
| `dashboard/` | Next.js SOC UI (built separately) |

## Documentation

| Doc | Read it when |
|---|---|
| `docs/PLAN.md` | day-by-day plan with owners and acceptance checks |
| `docs/DATA_SETUP.md` | downloading and verifying the real CICIDS2017 files |
| `docs/CODE_TOUR.md` | understanding why each module does what it does |
| `IMPLEMENTATION.md` | the eight build steps, shortest version |
| `dashboard/README.md` | running the SOC UI |

## Rules this repo keeps

1. No random train/test split. Flows are grouped into 5-minute blocks; a test fails
   the build if a block lands in two splits.
2. No bare accuracy. Reports carry per-class precision and recall, PR-AUC, and false
   alerts per 10,000 benign flows.
3. The alert threshold comes from a false-positive budget, not from 0.5.
4. Rare families (Infiltration, Heartbleed) are never trained on. They are test
   material for the anomaly detector.
5. No code path blocks, drops or rate-limits traffic.
