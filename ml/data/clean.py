"""Cleaning steps, in the order they must run."""
import numpy as np
import pandas as pd

ID_COLUMNS = [
    "Flow ID", "Source IP", "Src IP", "Destination IP", "Dst IP",
    "Source Port", "Src Port", "Fwd Header Length.1",
]


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # 1. timestamps kept until splitting, then dropped by feature selection
    if "Timestamp" in df.columns:
        df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce", dayfirst=True)

    # 2. identifiers out: the model must not memorise hosts
    df = df.drop(columns=[c for c in ID_COLUMNS if c in df.columns])

    # 3. infinities become NaN, then those rows go
    num = df.select_dtypes(include=[np.number]).columns
    df[num] = df[num].replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=list(num))

    # 4. constant columns carry no information
    const = [c for c in num if df[c].nunique(dropna=False) <= 1]
    df = df.drop(columns=const)

    # 5. exact duplicate rows inflate both training and test sets
    df = df.drop_duplicates()

    # 6. shrink: float64 is wasteful for flow counters
    num = df.select_dtypes(include=["float64"]).columns
    df[num] = df[num].astype("float32")
    return df.reset_index(drop=True)
