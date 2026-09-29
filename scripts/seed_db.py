"""Seed the alert database for offline demo.

Usage:
    python scripts/seed_db.py [--count 50]

Reads lib/mockData.ts-style records from the live scorer on synthetic data
and inserts them into the SQLite database so the dashboard shows a realistic
state without the replayer running.

Requires: make train (or make synthetic && make data && make train) to have
run first so models/v1/ exists, and the API must NOT be running when this
script writes to the database.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
import yaml

from api.db.models import AlertModel
from api.db.session import Base, SessionLocal, engine
from api.services.scorer import Scorer
from ml.features.select import feature_columns


def seed(count: int = 50, scenario: str = "known") -> None:
    cfg = yaml.safe_load(open(ROOT / "ml" / "config.yaml"))
    processed = ROOT / cfg["paths"]["processed"]
    if not processed.exists():
        raise SystemExit("run `make data` first — data/processed/flows.pkl not found")

    df = pd.read_pickle(processed).sample(frac=1.0, random_state=42)
    features = feature_columns(df)

    if scenario == "known":
        rows = df[df["family"].isin(["DDoS", "PortScan", "DoS"])].head(count)
    elif scenario == "novel":
        rows = df[~df["family"].isin(["Benign", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Bot"])].head(count)
    else:
        rows = df.head(count)

    if rows.empty:
        raise SystemExit(f"no rows matched scenario={scenario!r}")

    scorer = Scorer()
    flows = [{f: float(r[f]) for f in features} for _, r in rows.iterrows()]
    metas = [{"dst_port": str(int(r.get("Destination Port", 0))),
              "truth": str(r["family"])} for _, r in rows.iterrows()]
    alerts = scorer.score(flows, metas)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    from datetime import datetime
    try:
        for a in alerts:
            db.add(AlertModel(
                id=a["id"],
                timestamp=datetime.fromisoformat(a["timestamp"].replace("Z", "+00:00")),
                flow=a["flow"],
                prediction=a["prediction"],
                anomaly_score=a["anomaly_score"],
                is_novel=a["is_novel"],
                severity=a["severity"],
                explanation=a["explanation"],
                mitre=a["mitre"],
                recommended_action=a["recommended_action"],
                status=a["status"],
                analyst_label=a["analyst_label"],
                analyst_note=a["analyst_note"],
                model_version=a["model_version"],
            ))
        db.commit()
        print(f"seeded {len(alerts)} alerts from {len(flows)} flows (scenario={scenario!r})")
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=50)
    ap.add_argument("--scenario", default="known", choices=["known", "novel", "normal"])
    args = ap.parse_args()
    seed(args.count, args.scenario)
