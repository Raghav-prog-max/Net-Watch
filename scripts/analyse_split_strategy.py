"""Analyse the CICIDS2017 dataset's day × time distribution and
propose a stratified splitting strategy.

CICIDS2017 has a structural problem for ML evaluation:
  - Monday:    Benign only
  - Tuesday:   BruteForce (FTP-Patator, SSH-Patator)
  - Wednesday: DoS (Hulk, GoldenEye, Slowloris, Slowhttptest) + Heartbleed
  - Thursday:  WebAttack (morning) + Infiltration (afternoon)
  - Friday:    Bot + PortScan + DDoS

A naive 5-minute block split ignores this: it can put ALL of one day's attack
blocks into train and leave test with none. The current code handles this with
per-family stratification of blocks, but doesn't explicitly account for hour-of-day
concentration (e.g. a model could memorise "attacks happen at 14:00").

This script:
  1. Loads the processed data and prints the full day × family heatmap
  2. Creates time proxies (morning/midday/afternoon/evening) using true Timestamps
     if available, or sequential row quartiles if missing (like in the Kaggle dataset).
  3. Simulates the existing split strategy and checks for day/time bias.
  4. Proposes and tests an improved strategy: stratify by (day, time_bin)
     so that each day's time chunks are spread across train/val/test.

Usage:
    python scripts/analyse_split_strategy.py
    python scripts/analyse_split_strategy.py --propose
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.data.labels import TRAIN_FAMILIES, NOVEL_ONLY
from ml.data.load import load_processed
from ml.data.split import add_blocks, block_strata, make_splits


# == Helpers ===================================================================

DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
              "Saturday", "Sunday"]

def day_sort_key(day):
    try:
        return DAYS_ORDER.index(day)
    except ValueError:
        return 99

def hour_bin(hour):
    if hour < 10: return "morning"
    if hour < 13: return "midday"
    if hour < 17: return "afternoon"
    return "evening"

def assign_time_bins(df):
    """Adds 'time_bin' (morning/midday/afternoon/evening).
    Uses Timestamp if available, otherwise divides each day's rows into 4 quartiles."""
    df = df.copy()
    has_ts = "Timestamp" in df.columns and df["Timestamp"].notna().any()
    
    if has_ts:
        df["time_bin"] = df["Timestamp"].dt.hour.apply(hour_bin)
    else:
        # Fallback: sequential row quartiles per day
        bins = []
        for day in df["day"].unique():
            mask = df["day"] == day
            n = mask.sum()
            q = np.array(["morning"] * n)
            q[n//4 : 2*n//4] = "midday"
            q[2*n//4 : 3*n//4] = "afternoon"
            q[3*n//4 :] = "evening"
            bins.append(pd.Series(q, index=df.index[mask]))
        df["time_bin"] = pd.concat(bins)
    
    return df, has_ts

def separator(title, width=72):
    print(f"\n{'=' * width}")
    print(f"  {title}")
    print(f"{'=' * width}\n")


# == 1. Day x Time x Family heatmap ============================================

def analyse_distribution(df, has_ts):
    separator("1. DATASET SHAPE")
    print(f"Total flows:    {len(df):>10,}")
    print(f"Columns:        {df.shape[1]:>10}")
    print(f"Days present:   {sorted(df['day'].unique(), key=day_sort_key)}")
    print(f"Has timestamps: {has_ts}")

    separator("2. FLOWS PER DAY x FAMILY")
    ct = pd.crosstab(df["day"], df["family"], margins=True)
    order = [d for d in DAYS_ORDER if d in ct.index] + [d for d in ct.index if d not in DAYS_ORDER and d != "All"]
    if "All" in ct.index:
        order.append("All")
    ct = ct.reindex(order)
    print(ct.to_string())

    separator("3. FLOWS PER DAY x TIME BIN")
    ct_bin = pd.crosstab(df["day"], df["time_bin"])
    order_b = [d for d in DAYS_ORDER if d in ct_bin.index]
    ct_bin = ct_bin.reindex(order_b)
    for col in ["morning", "midday", "afternoon", "evening"]:
        if col not in ct_bin.columns:
            ct_bin[col] = 0
    ct_bin = ct_bin[["morning", "midday", "afternoon", "evening"]]
    print(ct_bin.to_string())


# == 2. Block analysis =========================================================

def analyse_blocks(df, block_minutes):
    separator("4. TIME-BLOCK ANALYSIS")
    df = add_blocks(df, block_minutes)
    n_blocks = df["block"].nunique()
    print(f"Block size:      {block_minutes} minutes (or 1000-row chunks)")
    print(f"Total blocks:    {n_blocks}")

    blocks_per_day = df.groupby("day")["block"].nunique()
    blocks_per_day = blocks_per_day.reindex([d for d in DAYS_ORDER if d in blocks_per_day.index])
    print(f"\nBlocks per day:")
    for day, n in blocks_per_day.items():
        print(f"  {day:<12s}  {n:>4} blocks")

    strata = block_strata(df)
    strata_counts = strata.value_counts()
    print(f"\nBlocks per family (stratum owner):")
    for fam, n in strata_counts.items():
        print(f"  {fam:<12s}  {n:>4} blocks")

    print(f"\nFamilies in <= 5 blocks (splitting risk):")
    for fam, n in strata_counts.items():
        if n <= 5 and fam != "Benign":
            print(f"  [WARN] {fam}: only {n} blocks (split gives {max(0, n-2)} train / 1 val / 1 test)")

    return df


# == 3. Existing split diagnosis ===============================================

def diagnose_existing_split(df, test_size, random_state):
    separator("5. EXISTING SPLIT DIAGNOSIS (current split.py)")
    df = add_blocks(df, 5)
    train, val, test = make_splits(df, test_size, random_state)

    for name, part in [("train", train), ("val", val), ("test", test)]:
        fam_counts = part["family"].value_counts()
        n = len(part)
        print(f"\n{name.upper()} ({n:,} flows, {part['block'].nunique()} blocks):")
        for fam in sorted(fam_counts.index):
            print(f"  {fam:<12s}  {fam_counts[fam]:>8,}  ({100*fam_counts[fam]/n:5.1f}%)")

    print(f"\nDay x time-bin block allocation (potential bias):")
    for name, part in [("train", train), ("val", val), ("test", test)]:
        p = part.copy()
        ct = pd.crosstab(p["day"], p["time_bin"])
        order = [d for d in DAYS_ORDER if d in ct.index]
        ct = ct.reindex(order)
        for col in ["morning", "midday", "afternoon", "evening"]:
            if col not in ct.columns: ct[col] = 0
        ct = ct[["morning", "midday", "afternoon", "evening"]]
        print(f"\n  {name.upper()} flows by day x time-bin:")
        for row in ct.itertuples():
            print(f"    {row.Index:<12s}  morn={row.morning:>6,}  mid={row.midday:>6,}  "
                  f"aftn={row.afternoon:>6,}  eve={row.evening:>6,}")


# == 4. Proposed strategy ======================================================

def propose_day_time_split(df, block_minutes, test_size, random_state):
    separator("6. PROPOSED STRATEGY: DAY x TIME-BIN STRATIFIED SPLIT")
    print("""Rationale:
  Current approach stratifies blocks by family. But it doesn't control for time 
  of day: a family's morning blocks could all land in train while afternoon blocks 
  land in test. 
  
  Proposed improvement:
  - Keep the per-family block stratification.
  - Within each family's blocks, sub-stratify by (day, time_bin) so that
    morning/midday/afternoon blocks from the same day are spread evenly across splits.
""")

    df = add_blocks(df, block_minutes)

    block_info = df.groupby("block").agg(
        day=("day", "first"),
        time_bin=("time_bin", lambda x: x.mode()[0]), # most common bin in block
        n_flows=("family", "size"),
    )
    block_info["family_stratum"] = block_strata(df)
    block_info["split_key"] = (block_info["family_stratum"] + "|" +
                               block_info["day"].astype(str) + "|" +
                               block_info["time_bin"])

    rng = np.random.RandomState(random_state)
    assignment = {}

    for key, group in block_info.groupby("split_key"):
        blocks = sorted(group.index.tolist())
        blocks = [blocks[i] for i in rng.permutation(len(blocks))]
        n = len(blocks)

        if n >= 3:
            n_held = min(max(1, int(n * test_size / 2 + 0.5)), (n - 1) // 2)
            for i, b in enumerate(blocks):
                if i < n_held: assignment[b] = "val"
                elif i < 2 * n_held: assignment[b] = "test"
                else: assignment[b] = "train"
        elif n == 2:
            assignment[blocks[0]] = "train"
            assignment[blocks[1]] = "test"
        else:
            assignment[blocks[0]] = "train"

    # Ensure every TRAIN_FAMILY has at least one block in test
    for fam in TRAIN_FAMILIES:
        fam_blocks = block_info[block_info["family_stratum"] == fam].index
        if not fam_blocks.any(): continue
        in_test = [b for b in fam_blocks if assignment.get(b) == "test"]
        if not in_test:
            in_train = [b for b in fam_blocks if assignment.get(b) == "train"]
            if in_train:
                assignment[in_train[-1]] = "test"
                print(f"  [WARN] Forced block for {fam} into test (had none)")

    where = df["block"].map(assignment).fillna("train")
    
    proposed_train = df[where == "train"].reset_index(drop=True)
    proposed_val = df[where == "val"].reset_index(drop=True)
    proposed_test = df[where == "test"].reset_index(drop=True)

    # Leakage check
    separator("7. LEAKAGE CHECK")
    b_tr, b_va, b_te = set(proposed_train["block"]), set(proposed_val["block"]), set(proposed_test["block"])
    leak_tv, leak_tt, leak_vt = b_tr & b_va, b_tr & b_te, b_va & b_te
    if leak_tv or leak_tt or leak_vt:
        print(f"  [FAIL] LEAKAGE DETECTED")
    else:
        print(f"  [PASS] No block appears in two splits")

    # Output comparison
    separator("8. COMPARISON: EXISTING vs PROPOSED SPLIT RATIOS")
    df2 = add_blocks(df.drop(columns=["block"], errors="ignore"), block_minutes)
    old_train, old_val, old_test = make_splits(df2, test_size, random_state)

    print(f"  {'':20s} {'Existing':>12s} {'Proposed':>12s}")
    print(f"  {'-' * 50}")
    for fam in sorted(set(TRAIN_FAMILIES + NOVEL_ONLY)):
        old_tr, old_te = (old_train["family"] == fam).sum(), (old_test["family"] == fam).sum()
        new_tr, new_te = (proposed_train["family"] == fam).sum(), (proposed_test["family"] == fam).sum()
        old_r = f"{old_tr}/{old_te}" if old_te else f"{old_tr}/0"
        new_r = f"{new_tr}/{new_te}" if new_te else f"{new_tr}/0"
        print(f"  {fam:<20s} {old_r:>12s} {new_r:>12s}")

    return proposed_train, proposed_val, proposed_test


# == main ======================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="ml/config.yaml")
    ap.add_argument("--propose", action="store_true")
    a = ap.parse_args()

    cfg = yaml.safe_load(open(a.config))
    processed = cfg["paths"]["processed"]

    if not Path(processed).exists():
        print(f"[FAIL] {processed} not found. Run `make data` first.")
        sys.exit(1)

    df = load_processed(processed)
    df = df[df["family"].isin(TRAIN_FAMILIES + NOVEL_ONLY)].copy()
    
    df, has_ts = assign_time_bins(df)

    analyse_distribution(df, has_ts)
    block_minutes = cfg["split"]["block_minutes"]
    test_size = cfg["split"]["test_size"]
    random_state = cfg["split"]["random_state"]

    analyse_blocks(df, block_minutes)
    diagnose_existing_split(df, test_size, random_state)
    
    train, val, test = propose_day_time_split(df, block_minutes, test_size, random_state)

    if a.propose and train is not None:
        out = Path(cfg["paths"].get("splits", "data/splits"))
        out.mkdir(parents=True, exist_ok=True)
        train.to_pickle(out / "train.pkl")
        val.to_pickle(out / "val.pkl")
        test.to_pickle(out / "test.pkl")
        print(f"\n[PASS] Proposed splits written to {out}/")

if __name__ == "__main__":
    main()
