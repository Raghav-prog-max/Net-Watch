"""Copy reports/metrics.json into the dashboard's offline fallback.

    python scripts/dashboard_snapshot.py      (make dashboard-snapshot)

The dashboard shows the live API's report when it can reach it. When it cannot
(a laptop with no backend running), it falls back to MOCK_EVALUATION_REPORT in
dashboard/lib/mockData.ts. That fallback must be our own last training run, not
invented numbers, so refresh it after every `make train`.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT = ROOT / "reports" / "metrics.json"
TARGET = ROOT / "dashboard" / "lib" / "mockData.ts"
KEYS = ("generated", "classifier", "rows", "threshold", "main",
        "random_forest_baseline", "naive_comparison", "lofo", "novel_families")
START = "export const MOCK_EVALUATION_REPORT"
END = "export const MOCK_DRIFT_STATUS"


def synthetic():
    raw = ROOT / "data" / "raw"
    return raw.exists() and any(p.name.lower().startswith("synthetic") for p in raw.iterdir())


def main():
    if not REPORT.exists():
        sys.exit(f"{REPORT} not found; run `make train` first")
    report = json.loads(REPORT.read_text())
    snap = {k: report[k] for k in KEYS if k in report}
    snap["synthetic_data"] = synthetic()
    data = "synthetic data" if snap["synthetic_data"] else "CICIDS2017"
    block = (f"// Offline fallback: a copy of reports/metrics.json from the run below ({data}).\n"
             "// Refresh it after retraining with `make dashboard-snapshot`.\n"
             f"{START}: EvaluationReport = {json.dumps(snap, indent=2)};\n\n")
    src = TARGET.read_text(encoding="utf-8")
    a, b = src.index(START), src.index(END)
    # keep the comment lines that sit directly above the constant
    a = src.rfind("\n\n", 0, a) + 2
    TARGET.write_text(src[:a] + block + src[b:], encoding="utf-8")
    print(f"dashboard snapshot <- {REPORT.name} generated {report.get('generated')}")


if __name__ == "__main__":
    main()
