"""
tests/test_combine.py
──────────────────────
Unit tests for ml/models/combine.py:
  - severity() function
  - decide() decision table
  - FAMILY_WEIGHT completeness
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from ml.models.combine import (  # noqa: E402
    severity, decide, FAMILY_WEIGHT, AlertDecision,
)
from ml.data.labels import FAMILIES  # noqa: E402


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

    def test_higher_confidence_higher_score(self):
        s_low,  _ = severity(0.1, 0.1, "DoS")
        s_high, _ = severity(0.9, 0.9, "DoS")
        assert s_high > s_low


class TestFamilyWeight:
    def test_all_families_have_weight(self):
        required = {"DDoS", "Bot", "WebAttack", "DoS", "BruteForce", "Unknown", "PortScan"}
        for fam in required:
            assert fam in FAMILY_WEIGHT, f"Missing weight for {fam}"

    def test_weights_in_range(self):
        for fam, w in FAMILY_WEIGHT.items():
            assert 0.0 <= w <= 1.0, f"Weight out of range for {fam}: {w}"


class TestDecide:
    def _proba(self, benign_p: float) -> np.ndarray:
        """Build a probability array where P(Benign)=benign_p, rest split equally."""
        n = len(FAMILIES)
        remaining = (1.0 - benign_p) / (n - 1)
        proba = np.full(n, remaining)
        proba[0] = benign_p  # Benign is index 0
        return proba

    def test_known_attack_triggers_alert(self):
        # High attack score → alert, classifier determines family
        proba = self._proba(benign_p=0.05)  # attack score = 0.95
        result = decide(
            attack_score=0.95,
            classifier_proba=proba,
            class_names=FAMILIES,
            is_anomalous=False,
            anomaly_pct=0.5,
            threshold=0.5,
        )
        assert result.should_alert is True
        assert result.is_novel is False

    def test_benign_no_anomaly_no_alert(self):
        proba = self._proba(benign_p=0.95)  # attack score = 0.05
        result = decide(
            attack_score=0.05,
            classifier_proba=proba,
            class_names=FAMILIES,
            is_anomalous=False,
            anomaly_pct=0.05,
            threshold=0.5,
        )
        assert result.should_alert is False
        assert result.family == "Benign"

    def test_novel_anomaly_triggers_unknown_alert(self):
        # Classifier says benign, but anomaly detector fires → novel
        proba = self._proba(benign_p=0.92)  # attack score = 0.08 (below threshold)
        result = decide(
            attack_score=0.08,
            classifier_proba=proba,
            class_names=FAMILIES,
            is_anomalous=True,
            anomaly_pct=0.9,
            threshold=0.5,
        )
        assert result.should_alert is True
        assert result.is_novel is True
        assert result.family == "Unknown"

    def test_severity_on_alert(self):
        proba = self._proba(benign_p=0.05)
        result = decide(
            attack_score=0.95,
            classifier_proba=proba,
            class_names=FAMILIES,
            is_anomalous=True,
            anomaly_pct=0.8,
            threshold=0.5,
        )
        assert result.severity_score >= 0
        assert result.severity_level in {"Critical", "High", "Medium", "Low"}

    def test_recommended_action_is_string(self):
        proba = self._proba(benign_p=0.05)
        result = decide(0.95, proba, FAMILIES, False, 0.5, 0.5)
        assert isinstance(result.recommended_action, str)
        assert len(result.recommended_action) > 0
