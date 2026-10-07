"""Cleaning steps, in the order they must run."""
import numpy as np
import pandas as pd

ID_COLUMNS = ["Flow ID", "Source Port", "Src Port", "Fwd Header Length.1"]

# Kept for display only: the replayer shows them on the alert, and feature
# selection never uses them (ml/features/select.py NON_FEATURES), so the model
# still cannot memorise hosts. CICIDS2017 files name them either way.
DISPLAY_COLUMNS = {"Source IP": "Source IP", "Src IP": "Source IP",
                   "Destination IP": "Destination IP", "Dst IP": "Destination IP"}


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # 1. timestamps kept until splitting, then dropped by feature selection
    if "Timestamp" in df.columns:
        df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce", dayfirst=True)

    # 2. identifiers out: the model must not memorise hosts. IPs stay as
    #    display-only text under one name each.
    df = df.drop(columns=[c for c in ID_COLUMNS if c in df.columns])
    df = df.rename(columns={c: n for c, n in DISPLAY_COLUMNS.items() if c in df.columns})
    shown = [c for c in set(DISPLAY_COLUMNS.values()) if c in df.columns]

    # 3. infinities become NaN, then those rows go
    num = df.select_dtypes(include=[np.number]).columns
    df[num] = df[num].replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=list(num))

    # 4. constant columns carry no information
    const = [c for c in num if df[c].nunique(dropna=False) <= 1]
    df = df.drop(columns=const)

    # 5. exact duplicate rows inflate both training and test sets; two flows
    #    that differ only in their (display-only) IPs are the same to the model
    df = df.drop_duplicates(subset=[c for c in df.columns if c not in shown])

    # 6. shrink: float64 is wasteful for flow counters
    num = df.select_dtypes(include=["float64"]).columns
    df[num] = df[num].astype("float32")
    return df.reset_index(drop=True)
