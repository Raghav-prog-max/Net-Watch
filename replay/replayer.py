"""Streams held-out flows at the API so the demo looks like live traffic.

    python replay/replayer.py --scenario novel --rate 40

Scenarios:
  normal  benign traffic only, to show the false-alert rate
  known   a DDoS and PortScan burst
  novel   families the classifier never trained on
  drift   test traffic with shifted feature distributions
  mixed   everything, in timestamp order
"""
import argparse
import json
import time
import urllib.error
import urllib.request

import numpy as np
import pandas as pd
import yaml

# Running this file as a script puts replay/ on sys.path, not the repository root,
# so the ml package below would not resolve and `make demo` would die on import.
# Make the root importable before touching it.
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.data.labels import TRAIN_FAMILIES
from ml.features.select import feature_columns


def pick(df, scenario, limit=None):
    if scenario == "normal":
        return df[df["family"] == "Benign"]
    if scenario == "known":
        return df[df["family"].isin(["DDoS", "PortScan", "DoS"])]
    if scenario == "novel":
        return df[~df["family"].isin(TRAIN_FAMILIES)]
    if scenario == "drift":
        # Return the held-out drift set
        drift_path = Path("data/splits/drift.pkl")
        if drift_path.exists():
            out = pd.read_pickle(drift_path)
            # Sample it so it fits the limit
            out = out.sample(frac=1.0, random_state=3).reset_index(drop=True)
            if limit:
                out = out.iloc[:limit]
            return out
        else:
            print("Warning: data/splits/drift.pkl not found, returning empty dataframe.")
            return df.iloc[:0]
    return df


def post(url, batch):
    req = urllib.request.Request(url, data=json.dumps({"flows": batch}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def build_batch(chunk, features):
    """Rows -> the POST /score payload items (api/schemas.py ScoredFlow)."""
    return [{"features": {f: float(r[f]) for f in features},
             "meta": {"dst_port": str(int(r.get("Destination Port", 0))),
                      "truth": str(r["family"])}}
            for _, r in chunk.iterrows()]


def main(a):
    cfg = yaml.safe_load(open(a.config))
    df = pd.read_pickle(cfg["paths"]["processed"]).sample(frac=1.0, random_state=1)
    rows = pick(df, a.scenario, a.limit)
    features = feature_columns(df)
    print(f"{a.scenario}: {len(rows):,} flows at {a.rate}/s -> {a.url}")

    sent = alerts = 0
    for start in range(0, min(len(rows), a.limit), a.batch):
        chunk = rows.iloc[start:start + a.batch]
        batch = build_batch(chunk, features)
        try:
            res = post(a.url, batch)
        except urllib.error.HTTPError as e:
            # say why, instead of a bare "HTTP Error 422" traceback
            raise SystemExit(f"{a.url} returned {e.code}: {e.read().decode(errors='replace')[:500]}")
        sent += len(batch); alerts += len(res["alerts"])
        for al in res["alerts"][:2]:
            print(f"  {al['severity']['level']:<8} {al['prediction']['family']:<10} "
                  f"truth={al['flow'].get('truth', '?')}")
        time.sleep(len(batch) / max(a.rate, 1))
    print(f"sent {sent} flows, {alerts} alerts ({100 * alerts / max(sent, 1):.1f}%)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="mixed",
                    choices=["normal", "known", "novel", "drift", "mixed"])
    # 127.0.0.1, not localhost: on Windows "localhost" tries IPv6 first and every
    # request waited ~2 s for the fallback, a tenth of the replay rate
    ap.add_argument("--url", default="http://127.0.0.1:8000/score")
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--rate", type=int, default=40)
    ap.add_argument("--batch", type=int, default=20)
    ap.add_argument("--limit", type=int, default=5000)
    main(ap.parse_args())
