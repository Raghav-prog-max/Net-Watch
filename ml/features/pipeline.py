"""
ml/features/pipeline.py
────────────────────────
Sklearn-compatible feature pipelines.

  - classifier_pipeline()  : passthrough (LightGBM handles raw floats)
  - anomaly_pipeline()     : StandardScaler (IsolationForest is sensitive to scale)

Both pipelines operate on the feature_cols list produced by select.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


class ColumnSelector:
    """
    Sklearn-compatible transformer that selects a fixed list of columns
    from a DataFrame and returns a numpy array.
    """

    def __init__(self, feature_cols: list[str]) -> None:
        self.feature_cols = feature_cols

    def fit(self, X: pd.DataFrame, y=None):
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        return X[self.feature_cols].astype("float32").values

    def get_feature_names_out(self) -> list[str]:
        return list(self.feature_cols)


def classifier_pipeline(feature_cols: list[str]) -> Pipeline:
    """
    Lightweight pipeline for the LightGBM / RandomForest classifier.
    Only selects & type-casts columns; no scaling (tree models don't need it).
    """
    return Pipeline([
        ("select", ColumnSelector(feature_cols)),
    ])


def anomaly_pipeline(feature_cols: list[str]) -> Pipeline:
    """
    Pipeline for the IsolationForest anomaly detector.
    Adds StandardScaler because IsolationForest uses random feature splits
    and performs better with comparable feature magnitudes.
    """
    return Pipeline([
        ("select", ColumnSelector(feature_cols)),
        ("scaler", StandardScaler()),
    ])
