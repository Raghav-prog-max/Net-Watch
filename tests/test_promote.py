"""Promotion switches models/ACTIVE and keeps every bundle; rollback switches back.

Promotion used to mean copying models/v2 over models/v1, which destroyed the
model to roll back to, while the API kept serving v1's report beside v2's models.

Run: pytest tests/test_promote.py
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml import registry
from scripts import retrain
from scripts.promote import promote

BUDGET = 50.0


def _bundle(models, version, marker):
    d = models / version
    d.mkdir(parents=True)
    for f in registry.BUNDLE_FILES:
        (d / f).write_text(f"{version} {marker}")


def _report(reports, version, macro_f1, false_alerts):
    path = registry.report_path(version, reports)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "main": {"macro_f1": macro_f1, "false_alerts_per_10k_benign_flows": false_alerts},
        "system": {"false_alerts_per_10k_benign_flows": false_alerts}}))


@pytest.fixture
def store(tmp_path):
    models, reports = tmp_path / "models", tmp_path / "reports"
    _bundle(models, "v1", "original")
    _report(reports, "v1", 0.90, 44.7)
    return models, reports


def _promote(store, version, **kw):
    models, reports = store
    return promote(version, budget_per_10k=BUDGET, models=models, reports=reports, **kw)


def test_without_a_pointer_v1_is_active(store):
    models, _ = store
    assert registry.active_version(models) == "v1"
    (models / "ACTIVE").write_text("\n")
    assert registry.active_version(models) == "v1"


def test_reports_follow_the_version(tmp_path):
    assert registry.report_path("v1", tmp_path) == tmp_path / "metrics.json"
    assert registry.report_path("v2", tmp_path) == tmp_path / "v2" / "metrics.json"


def test_promotion_renames_v2_to_v1_and_archives_old_v1(store):
    models, reports = store
    _bundle(models, "v2", "retrained")
    _report(reports, "v2", 0.92, 40.0)
    assert _promote(store, "v2") == "v1"
    assert registry.active_version(models) == "v1"
    assert (models / "1.1").exists()
    assert all((models / "1.1" / f).read_text() == "v1 original" for f in registry.BUNDLE_FILES), (
        "v1 must survive a promotion untouched in the archive")


def test_rollback_from_archive_skips_the_check(store):
    models, reports = store
    _bundle(models, "1.1", "archived")
    _report(reports, "1.1", 0.85, 60.0)
    with pytest.raises(SystemExit, match="not promoting"):
        _promote(store, "1.1")
    assert _promote(store, "1.1", rollback=True) == "v1"
    assert registry.active_version(models) == "v1"
    assert (models / "1.2").exists()  # previous v1 gets archived


@pytest.mark.parametrize("macro_f1, false_alerts, why", [
    (0.90, 40.0, "macro-F1 did not improve"),
    (0.89, 40.0, "macro-F1 did not improve"),
    (0.95, 51.0, "false alerts over budget"),
])
def test_a_candidate_that_fails_the_check_changes_nothing(store, macro_f1, false_alerts, why):
    models, reports = store
    _bundle(models, "v2", "retrained")
    _report(reports, "v2", macro_f1, false_alerts)
    with pytest.raises(SystemExit, match=why):
        _promote(store, "v2")
    assert not (models / "ACTIVE").exists()


def test_an_incomplete_bundle_is_refused(store):
    models, reports = store
    _bundle(models, "v2", "retrained")
    (models / "v2" / "classifier.joblib").unlink()
    _report(reports, "v2", 0.95, 30.0)
    with pytest.raises(SystemExit, match="missing classifier.joblib"):
        _promote(store, "v2", rollback=True)
    assert not (models / "ACTIVE").exists()


def test_promoting_the_active_bundle_is_refused(store):
    with pytest.raises(SystemExit, match="v1 is already production"):
        _promote(store, "v1", rollback=True)


def test_retraining_never_writes_over_v1(monkeypatch):
    monkeypatch.setattr(registry, "active_version", lambda *a, **k: "v1")
    with pytest.raises(SystemExit, match="For retraining, use models/v2"):
        retrain.main("ml/config.yaml", "models/v1")
