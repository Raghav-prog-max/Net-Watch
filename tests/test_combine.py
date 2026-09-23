"""
tests/test_combine.py
──────────────────────
Unit tests for ml/models/combine.py:
  - severity() function
  - decide() decision table
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from ml.models.combine import severity, decide, FAMILY_WEIGHT
from ml.data.labels import TRAIN_FAMILIES as FAMILIES


class TestSeverity:
    def test_critical(self):
        score, level = severity(confidence=1.0, anomaly_pct=1.0, family="DDoS")
        assert level == "Critical"
        assert score >= 85

    def test_low(self):
        score, level = severity(confidence=0.0, anomaly_pct=0.0, family="PortScan")
        assert level in {"Low", "Medium"}
        assert score < 65

    def test_score_is_integer(self):
        score, _ = severity(0.7, 0.5, "Bot")
        assert isinstance(score, int)

    def test_score_bounded(self):
        for conf in np.linspace(0, 1, 5):
            for anom in np.linspace(0, 1, 5):
                for fam in FAMILY_WEIGHT:
                    score, _ = severity(float(conf), float(anom), fam)
                    assert 0 <= score <= 100, f"Score out of range: {score}"

    def test_level_enum(self):
        valid_levels = {"Critical", "High", "Medium", "Low"}
        for conf in [0.0, 0.5, 0.9, 1.0]:
            _, level = severity(conf, conf, "DoS")
            assert level in valid_levels


class TestFamilyWeight:
    def test_all_families_have_weight(self):
        required = {"DDoS", "Bot", "WebAttack", "DoS", "BruteForce", "Unknown", "PortScan"}
        for fam in required:
            assert fam in FAMILY_WEIGHT, f"Missing weight for {fam}"


class TestDecide:
    def test_known_attack_triggers_alert(self):
        result = decide(
            attack_score=0.95,
            family="DoS",
            confidence=0.9,
            anomaly_score=0.8,
            anomaly_pct=0.5,
            is_anomalous=False,
            attack_threshold=0.5,
            out_of_family=False
        )
        assert result is not None
        assert result["prediction"]["family"] == "DoS"
        assert result["is_novel"] is False

    def test_benign_no_anomaly_no_alert(self):
        result = decide(
            attack_score=0.05,
            family="Benign",
            confidence=0.95,
            anomaly_score=0.1,
            anomaly_pct=0.05,
            is_anomalous=False,
            attack_threshold=0.5,
            out_of_family=False
        )
        assert result is None

    def test_novel_anomaly_triggers_unknown_alert(self):
        result = decide(
            attack_score=0.08,
            family="Benign",
            confidence=0.9,
            anomaly_score=0.9,
            anomaly_pct=0.9,
            is_anomalous=True,
            attack_threshold=0.5,
            out_of_family=False
        )
        assert result is not None
        assert result["is_novel"] is True
        assert result["prediction"]["family"] == "Unknown"

    def test_severity_on_alert(self):
        result = decide(
            attack_score=0.95,
            family="DoS",
            confidence=0.9,
            anomaly_score=0.9,
            anomaly_pct=0.8,
            is_anomalous=True,
            attack_threshold=0.5,
            out_of_family=False
        )
        assert result is not None
        assert result["severity"]["score"] >= 0
        assert result["severity"]["level"] in {"Critical", "High", "Medium", "Low"}

    def test_recommended_action_is_string(self):
        result = decide(0.95, "DoS", 0.9, 0.8, 0.5, False, 0.5, False)
        assert result is not None
        assert isinstance(result["recommended_action"], str)
        assert len(result["recommended_action"]) > 0
