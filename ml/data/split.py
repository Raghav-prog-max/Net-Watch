"""Leakage-free splitting.

Flows from one attack burst are near-duplicates. Splitting them at random puts
copies of the same burst in train and test, which inflates every metric. We group
flows into short time blocks and split whole blocks instead.
"""
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit


def add_blocks(df: pd.DataFrame, block_minutes: int = 5) -> pd.DataFrame:
    df = df.copy()
    if "Timestamp" in df.columns and df["Timestamp"].notna().any():
        stamp = df["Timestamp"].dt.floor(f"{block_minutes}min").astype(str)
    else:  # fall back to row order when timestamps are missing
        stamp = (df.index // 1000).astype(str)
    day = df["day"].astype(str) if "day" in df.columns else "all"
    df["block"] = day + "_" + stamp
    return df


def make_splits(df, test_size=0.30, random_state=42):
    """Returns (train, val, test). No time block appears in more than one."""
    gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_i, rest_i = next(gss.split(df, groups=df["block"]))
    train, rest = df.iloc[train_i], df.iloc[rest_i]

    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=random_state)
    val_i, test_i = next(gss2.split(rest, groups=rest["block"]))
    return (train.reset_index(drop=True),
            rest.iloc[val_i].reset_index(drop=True),
            rest.iloc[test_i].reset_index(drop=True))


def lofo_split(train, val, family):
    """Remove one attack family from training and validation entirely."""
    return (train[train["family"] != family].reset_index(drop=True),
            val[val["family"] != family].reset_index(drop=True))


def downsample_benign(train, fraction, random_state=42):
    if fraction >= 1.0:
        return train
    benign = train[train["family"] == "Benign"].sample(frac=fraction, random_state=random_state)
    attacks = train[train["family"] != "Benign"]
    return pd.concat([benign, attacks]).sample(frac=1.0, random_state=random_state).reset_index(drop=True)
