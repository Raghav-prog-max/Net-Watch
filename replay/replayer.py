"""Streams held-out flows at the API so the demo looks like live traffic.

    python replay/replayer.py --scenario novel --rate 40

Scenarios:
  normal  benign traffic only, to show the false-alert rate
  known   a DDoS and PortScan burst
  novel   families the classifier never trained on
  drift   test's benign flows with packet sizes scaled and durations stretched,
          more as the replay goes on: the monitor goes stable -> warning -> drift
  day     the held-out day (data/splits/drift.pkl), unchanged: real drift,
          CICIDS2017 only
  mixed   everything, in timestamp order

Every scenario draws on flows the models were not fitted on: the test split,
plus all flows of the families the classifier never trains on (replay_pool).
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

# Written by ml/train.py. The drift scenario perturbs the test split; the day
# scenario replays the held-out day, which only data with a Monday has (CICIDS2017).
TEST_SPLIT = Path("data/splits/test.pkl")
DRIFT_SPLIT = Path("data/splits/drift.pkl")

# The handbook's drift set is "a held-out day, plus a perturbed copy of test with
# scaled packet sizes and stretched durations, to trigger the drift monitor on
# demand". Sizes and timings move by the same factor, so a flow stays consistent
# with itself: bigger packets over a longer flow, bytes per second unchanged and
# packets per second down by the factor. Packet counts and flags do not move.
# Only the columns a dataset has are touched (the synthetic data has a few).
SIZE_COLUMNS = [
    "Total Length of Fwd Packets", "Total Length of Bwd Packets",
    "Fwd Packet Length Max", "Fwd Packet Length Min", "Fwd Packet Length Mean",
    "Fwd Packet Length Std", "Bwd Packet Length Max", "Bwd Packet Length Min",
    "Bwd Packet Length Mean", "Bwd Packet Length Std", "Min Packet Length",
    "Max Packet Length", "Packet Length Mean", "Packet Length Std", "Average Packet Size",
    "Avg Fwd Segment Size", "Avg Bwd Segment Size", "Subflow Fwd Bytes", "Subflow Bwd Bytes",
]
SQUARED_SIZE_COLUMNS = ["Packet Length Variance"]
TIME_COLUMNS = [
    "Flow Duration", "Flow IAT Mean", "Flow IAT Std", "Flow IAT Max", "Flow IAT Min",
    "Fwd IAT Total", "Fwd IAT Mean", "Fwd IAT Std", "Fwd IAT Max", "Fwd IAT Min",
    "Bwd IAT Total", "Bwd IAT Mean", "Bwd IAT Std", "Bwd IAT Max", "Bwd IAT Min",
    "Active Mean", "Active Std", "Active Max", "Active Min",
    "Idle Mean", "Idle Std", "Idle Max", "Idle Min",
]
PER_SECOND_COLUMNS = ["Flow Packets/s", "Fwd Packets/s", "Bwd Packets/s"]


def perturb(df, factor):
    """Scale packet sizes and stretch durations by `factor` (a number, or one per row)."""
    out = df.copy()
    f = np.asarray(factor, dtype="float64")
    for c in SIZE_COLUMNS + TIME_COLUMNS:
        if c in out.columns:
            out[c] = out[c].to_numpy() * f
    for c in SQUARED_SIZE_COLUMNS:
        if c in out.columns:
            out[c] = out[c].to_numpy() * f ** 2
    for c in PER_SECOND_COLUMNS:
        if c in out.columns:
            out[c] = out[c].to_numpy() / f
    return out


def drift_ramp(df, limit=None, warn_level=1.2, peak=3.0):
    """The test split's benign flows, perturbed a little more as the replay goes
    on. The detector should stay mostly quiet while the drift monitor notices the
    distribution move.

    Phases, in stream order, so the status walks stable -> warning -> drift
    within one replay: a short baseline, a quick climb to a moderate shift,
    a hold there, then a ramp to the peak and a hold at it.

    The hold is what makes Warning visible. Drift is declared when PSI is at
    least Warning *and* the unexplained alert rate is >= 2x its training
    baseline (docs/drift_strategy.md); shifted flows raise that rate, so a
    straight ramp crossed 2x as soon as PSI crossed 0.10 and the status went
    stable -> drift. Sizes and timings together move PSI further than the old
    ramp (durations, bytes/s and packet counts): its 1.45x hold already read
    Warning in the first 1000 flows, so the hold is 1.2x. Measured end to end
    on the synthetic data at --limit 5000, one snapshot per 1000 flows: stable,
    warning, drift, drift, drift; 7% of the flows alert, mostly at the peak,
    because traffic past anything in training looks abnormal to the detector
    too, and it is the alert-rate rule that declares the drift.
    """
    out = df[df["family"] == "Benign"].sample(frac=1.0, random_state=3)
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
    n = len(out)
    hold = max(100, n // 20)                # unshifted baseline
    climb = hold + n // 20                  # quick climb to the moderate shift
    plateau = n // 2                        # hold it: PSI in the warning band
    ramp = plateau + n // 5                 # ramp to the peak, then hold it
    factor = np.ones(n)
    factor[hold:climb] = np.linspace(1.0, warn_level, climb - hold)
    factor[climb:plateau] = warn_level
    factor[plateau:ramp] = np.linspace(warn_level, peak, ramp - plateau)
    factor[ramp:] = peak
    return perturb(out, factor)


def replay_pool(df):
    """The flows the replayer may send, from the processed set `df`: none the
    models were fitted on. It sent every processed flow, training rows included,
    so the demo's false-alert rate and catches were partly measured on traffic
    the models had learned. The test split is the held-out time blocks; the
    families the classifier never trains on are test material whichever split
    they fell in (ml/data/split.py split_out_novel), so all of theirs come too."""
    if not TEST_SPLIT.exists():
        print(f"{TEST_SPLIT} not found (run `make train`); replaying every processed "
              "flow, training ones included")
        return df
    test = pd.read_pickle(TEST_SPLIT)
    return pd.concat([test[test["family"].isin(TRAIN_FAMILIES)],
                      df[~df["family"].isin(TRAIN_FAMILIES)]], ignore_index=True)


def pick(df, scenario, limit=None):
    """`df` is the replay pool (replay_pool), already shuffled."""
    if scenario == "normal":
        return df[df["family"] == "Benign"]
    if scenario == "known":
        return df[df["family"].isin(["DDoS", "PortScan", "DoS"])]
    if scenario == "novel":
        return df[~df["family"].isin(TRAIN_FAMILIES)]
    if scenario == "drift":
        # A perturbed copy of test (the pool's benign flows are test's): it moves
        # the monitor on demand, on any data. It used to replay the held-out day
        # whenever there was one, and nothing had checked that an ordinary Monday
        # trips the monitor; that is `day`.
        return drift_ramp(df, limit)
    if scenario == "day":
        # real drift: a whole day the model never saw, unchanged
        if not DRIFT_SPLIT.exists():
            raise SystemExit(f"{DRIFT_SPLIT} not found: only data with a Monday to hold out "
                             "(CICIDS2017) has a held-out day. Use --scenario drift.")
        out = pd.read_pickle(DRIFT_SPLIT).sample(frac=1.0, random_state=3).reset_index(drop=True)
        return out.iloc[:limit] if limit else out
    # mixed: everything, in the order it happened (the pool is shuffled)
    return df.sort_values("Timestamp", kind="stable") if "Timestamp" in df.columns else df


def post(url, batch):
    req = urllib.request.Request(url, data=json.dumps({"flows": batch}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def build_batch(chunk, features):
    """Rows -> the POST /score payload items (api/schemas.py ScoredFlow)."""
    # no meta: the API reads the flow facts off the features, and the family is
    # the answer the system is being tested on, not something to show analysts
    return [{"features": {f: float(r[f]) for f in features}} for _, r in chunk.iterrows()]


def main(a):
    cfg = yaml.safe_load(open(a.config))
    df = replay_pool(pd.read_pickle(cfg["paths"]["processed"])).sample(frac=1.0, random_state=1)
    rows = pick(df, a.scenario, a.limit)
    features = feature_columns(df)
    print(f"{a.scenario}: {len(rows):,} flows at {a.rate}/s -> {a.url}")

    sent = alerted = 0
    for start in range(0, min(len(rows), a.limit), a.batch):
        chunk = rows.iloc[start:start + a.batch]
        batch = build_batch(chunk, features)
        try:
            res = post(a.url, batch)
        except urllib.error.HTTPError as e:
            # say why, instead of a bare "HTTP Error 422" traceback
            raise SystemExit(f"{a.url} returned {e.code}: {e.read().decode(errors='replace')[:500]}")
        # one alert per burst of a family (api/routes/score.py), so the alert
        # rate is the flows that raised one, not the alerts sent back
        sent += len(batch); alerted += res.get("alerted", len(res["alerts"]))
        for al in res["alerts"][:2]:
            print(f"  {al['severity']['level']:<8} {al['prediction']['family']:<10} "
                  f"x{al.get('flow_count', 1)}")
        time.sleep(len(batch) / max(a.rate, 1))
    print(f"sent {sent} flows, {alerted} raised an alert ({100 * alerted / max(sent, 1):.1f}%)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="mixed",
                    choices=["normal", "known", "novel", "drift", "day", "mixed"])
    # 127.0.0.1, not localhost: on Windows "localhost" tries IPv6 first and every
    # request waited ~2 s for the fallback, a tenth of the replay rate
    ap.add_argument("--url", default="http://127.0.0.1:8000/score")
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--rate", type=int, default=40)
    ap.add_argument("--batch", type=int, default=20)
    ap.add_argument("--limit", type=int, default=5000)
    main(ap.parse_args())
