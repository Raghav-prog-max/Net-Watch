"""Synthetic CICIDS-shaped traffic so the pipeline runs before the download finishes.

    python scripts/make_synthetic.py --rows 60000

Never use this for reported numbers. It exists so day-1 plumbing work is not
blocked on a 2 GB download, and so CI has something to run against.
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

FEATURES = ["Flow Duration", "Total Fwd Packets", "Total Backward Packets",
            "Flow Bytes/s", "Flow Packets/s", "Fwd Packet Length Mean",
            "Bwd Packet Length Mean", "Flow IAT Mean", "Flow IAT Std",
            "SYN Flag Count", "ACK Flag Count", "Packet Length Variance",
            "Destination Port"]

# mean shift applied to the benign profile, per family
PROFILES = {
    "BENIGN": (0.0, 1.0, 0.60),
    "DoS Hulk": (2.2, 1.0, 0.12),
    "DDoS": (2.6, 1.2, 0.09),
    "PortScan": (-1.8, 0.8, 0.10),
    "FTP-Patator": (1.2, 0.7, 0.04),
    "Web Attack - XSS": (1.6, 0.9, 0.02),
    "Bot": (0.9, 1.4, 0.02),
    "Infiltration": (3.4, 1.6, 0.005),
    "Heartbleed": (-3.0, 0.6, 0.005),
}


def main(rows, out_dir, seed=7):
    rng = np.random.default_rng(seed)
    frames = []
    start = pd.Timestamp("2017-07-07 08:00:00")
    for label, (shift, scale, share) in PROFILES.items():
        n = max(int(rows * share), 20)
        base = rng.normal(shift, scale, size=(n, len(FEATURES)))
        # attacks arrive in bursts: rows inside a burst are near-duplicates,
        # which is exactly why a random split leaks.
        if label != "BENIGN":
            n_bursts = max(n // 200, 1)
            reps = -(-n // n_bursts)          # ceil, so short families still fill
            burst = np.repeat(rng.normal(shift, scale / 4, size=(n_bursts, len(FEATURES))),
                              reps, axis=0)[:n]
            base = 0.5 * base + 0.5 * burst
        df = pd.DataFrame(np.exp(base) * 100, columns=FEATURES)
        df["Destination Port"] = rng.choice([80, 443, 22, 21, 8080], size=n)
        df["Label"] = label
        df["Timestamp"] = start + pd.to_timedelta(rng.integers(0, 8 * 3600, size=n), unit="s")
        frames.append(df)

    out = pd.concat(frames, ignore_index=True).sample(frac=1.0, random_state=seed)
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    path = Path(out_dir) / "Synthetic-WorkingHours.pcap_ISCX.csv"
    out.to_csv(path, index=False)
    print(f"wrote {path} with {len(out):,} rows")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=60000)
    ap.add_argument("--out", default="data/raw")
    a = ap.parse_args()
    main(a.rows, a.out)
