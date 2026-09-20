"""Which columns the models actually see."""
import numpy as np
import pandas as pd

NON_FEATURES = {"Label", "family", "day", "block", "Timestamp"}


def feature_columns(df: pd.DataFrame) -> list:
    cols = [c for c in df.columns
            if c not in NON_FEATURES and pd.api.types.is_numeric_dtype(df[c])]
    return sorted(cols)


def matrix(df: pd.DataFrame, features: list) -> np.ndarray:
    return df[features].to_numpy(dtype="float32", copy=False)
