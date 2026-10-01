"""Streams held-out flows at the API so the demo looks like live traffic.

    python replay/replayer.py --scenario novel --rate 40

Scenarios:
  normal  benign traffic only, to show the false-alert rate
  known   a DDoS and PortScan burst
  novel   families the classifier never trained on
  drift   the held-out drift day (data/splits/drift.pkl), or a synthetic
          ramp of shifted benign traffic when there is no such split
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

# Written by ml/train.py when the data has a Monday to hold out (CICIDS2017).
# The synthetic data has no days, so there is no drift split to replay.
DRIFT_SPLIT = Path("data/splits/drift.pkl")


def synthetic_drift(df, limit=None):
    """Benign traffic with a gradual, made-up shift, for when there is no held-out
    drift day. The detector should stay mostly quiet while the drift monitor
    notices the distribution move.

    Phases, in stream order, so the status walks stable -> warning -> drift
    within one replay: a short baseline, a quick climb to a moderate shift,
    a hold there, then a ramp to the peak and a hold at it.

    The peak is 3x because smaller shifts do not cross the standard PSI
    bands this monitor uses. Flow features span orders of magnitude, so a
    multiplier is a small move in log space: measured end to end, 1.3x gives
    PSI ~0.08 (still "stable"), 1.6x ~0.23 ("warning"), 2x ~0.47 ("drift").

    The hold at 1.45x is what makes Warning visible. Drift is declared when
    PSI is at least Warning *and* the unexplained alert rate is >= 2x its
    training baseline (docs/drift_strategy.md). That baseline is ~0.1%, and
    shifted flows raise it, so a straight ramp crossed 2x at the same moment
    PSI crossed 0.10 and the status went stable -> drift. With every flow at
    1.4-1.45x, PSI sits at ~0.11-0.13 while the rate stays under 2x; at 1.5x
    the rate reaches 2x within 3000 flows. Measured end to end at --limit
    5000: stable, stable, warning, drift, drift (one snapshot per 1000).
    """
    out = df[df["family"] == "Benign"].sample(frac=0.5, random_state=3).copy()
    # Truncate before building the ramp, not after: the replayer only sends
    # --limit flows (5000 by default), and a ramp laid across all the sampled
    # rows would be cut off during the hold phase and never reach drift.
    if limit:
        out = out.iloc[:limit]
    # Phases are weighted toward the shifted levels on purpose. The drift window
    # holds up to 5000 flows and a demo replay is no longer than that, so
    # nothing ages out: the unshifted opening stays in the window and dilutes
    # PSI for the whole run. It is kept short (5%, at least 100 flows) so the
    # moderate hold can reach the warning band.
    n, warn_level, peak = len(out), 1.45, 3.0
    hold = max(100, n // 20)                # unshifted baseline
    climb = hold + n // 20                  # quick climb to the moderate shift
    plateau = n // 2                        # hold it: PSI in the warning band
    ramp = plateau + n // 5                 # ramp to the peak, then hold it
    factor = np.ones(n)
    factor[hold:climb] = np.linspace(1.0, warn_level, climb - hold)
    factor[climb:plateau] = warn_level
    factor[plateau:ramp] = np.linspace(warn_level, peak, ramp - plateau)
    factor[ramp:] = peak
    shift_cols = [c for c in ("Flow Duration", "Flow IAT Mean", "Flow Bytes/s",
                              "Total Fwd Packets") if c in out.columns]
    for c in shift_cols:
        out[c] = out[c].to_numpy() * factor
    return out


def pick(df, scenario, limit=None):
    if scenario == "normal":
        return df[df["family"] == "Benign"]
    if scenario == "known":
        return df[df["family"].isin(["DDoS", "PortScan", "DoS"])]
    if scenario == "novel":
        return df[~df["family"].isin(TRAIN_FAMILIES)]
    if scenario == "drift":
        # Prefer the held-out drift day: real drift, not a made-up one
        if DRIFT_SPLIT.exists():
            out = pd.read_pickle(DRIFT_SPLIT)
            # Sample it so it fits the limit
            out = out.sample(frac=1.0, random_state=3).reset_index(drop=True)
            if limit:
                out = out.iloc[:limit]
            return out
        # Without one (synthetic data) the scenario used to send nothing at all
        print(f"{DRIFT_SPLIT} not found (no held-out drift day in this data); "
              "replaying a synthetic drift ramp instead")
        return synthetic_drift(df, limit)
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
