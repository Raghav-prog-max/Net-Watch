from pathlib import Path

import pandas as pd
import pytest
import yaml

from api.services.scorer import MODEL_DIR, ModelsNotFound, Scorer
from api.services.mitre import get_mitre_dict
from ml.models.combine import severity

# the scorer's alerts get their severity from ml/models/combine.severity (via decide)

@pytest.mark.parametrize("family,confidence,anomaly_pct,expected_level", [
    ("DDoS", 1.0, 1.0, "Critical"),     # 100 * (0.5*1 + 0.3*1 + 0.2*1) = 100 >= 85 -> Critical
    ("DDoS", 0.0, 0.0, "Low"),          # 100 * (0 + 0 + 0.2) = 20 -> Low
    ("DDoS", 0.9, 0.8, "Critical"),     # 100 * (0.45 + 0.24 + 0.2) = 89
    ("DDoS", 0.5, 0.5, "Medium"),       # 100 * (0.25 + 0.15 + 0.2) = 60
    ("PortScan", 1.0, 1.0, "Critical"), # 100 * (0.5 + 0.3 + 0.1) = 90
    ("PortScan", 0.5, 0.5, "Medium"),   # 100 * (0.25 + 0.15 + 0.1) = 50
    ("Unknown", 1.0, 1.0, "Critical"),  # 100 * (0.5 + 0.3 + 0.16) = 96
])
def test_severity_logic_boundaries(family, confidence, anomaly_pct, expected_level):
    score, level = severity(confidence, anomaly_pct, family)
    assert level == expected_level

@pytest.mark.parametrize("family,expected_tactic", [
    ("DoS", "Impact"),
    ("DDoS", "Impact"),
    ("PortScan", "Reconnaissance / Discovery"),
    ("BruteForce", "Credential Access"),
    ("WebAttack", "Initial Access"),
    ("Bot", "Command and Control"),
    ("Unknown", "Unmapped"),
    ("Benign", "Unmapped"),
    ("RandomNonExistent", "Unmapped")
])
def test_mitre_mapping(family, expected_tactic):
    mapping = get_mitre_dict(family)
    assert mapping["tactic"] == expected_tactic


def test_missing_models_raise_a_clear_error(tmp_path):
    with pytest.raises(ModelsNotFound, match="make train"):
        Scorer(model_dir=str(tmp_path))


# ── the trained models themselves ────────────────────────────────────────────
# models/ and data/processed/ are gitignored, so on a fresh clone these skip
# until `make data && make train` has run.

def _processed_path():
    return Path(yaml.safe_load(open("ml/config.yaml"))["paths"]["processed"])

needs_models = pytest.mark.skipif(
    not (Path(MODEL_DIR) / "classifier.joblib").exists() or not _processed_path().exists(),
    reason="needs `make data && make train`")


@pytest.fixture(scope="module")
def scorer():
    return Scorer()


@pytest.fixture(scope="module")
def flows():
    return pd.read_pickle(_processed_path())


def _score(scorer, rows):
    feats = [{f: float(r[f]) for f in scorer.features} for _, r in rows.iterrows()]
    return scorer.score(feats, [{"truth": t} for t in rows["family"]])


@needs_models
def test_normal_traffic_is_mostly_silent(scorer, flows):
    benign = flows[flows["family"] == "Benign"].sample(1000, random_state=0)
    alerts = _score(scorer, benign)
    # threshold is set from a 0.5% false-positive budget; the detector adds ~1%
    assert len(alerts) / len(benign) < 0.05


@needs_models
def test_known_attacks_are_named(scorer, flows):
    portscan = flows[flows["family"] == "PortScan"].sample(200, random_state=0)
    alerts = _score(scorer, portscan)
    assert len(alerts) / len(portscan) > 0.9
    named = [a for a in alerts if a["prediction"]["family"] == "PortScan"]
    assert len(named) / len(alerts) > 0.9
    assert all(not a["is_novel"] for a in named)


@needs_models
def test_never_seen_families_are_shown_as_unknown(scorer, flows):
    from ml.data.labels import TRAIN_FAMILIES
    novel = flows[~flows["family"].isin(TRAIN_FAMILIES)]
    if novel.empty:
        pytest.skip("no held-out families in the processed data")
    alerts = _score(scorer, novel)
    assert len(alerts) / len(novel) > 0.9
    unknown = [a for a in alerts if a["prediction"]["family"] == "Unknown"]
    assert len(unknown) / len(alerts) > 0.8
    assert all(a["is_novel"] for a in unknown)


@needs_models
def test_same_port_different_traffic_gives_different_verdicts(scorer, flows):
    # the old mock decided on destination port alone; the models must not
    benign = flows[flows["family"] == "Benign"].iloc[:1].copy()
    attack = flows[flows["family"] == "PortScan"].iloc[:1].copy()
    benign["Destination Port"] = attack["Destination Port"].to_numpy()
    assert _score(scorer, benign) == []
    assert _score(scorer, attack) != []


@needs_models
def test_alert_carries_explanation_and_metadata(scorer, flows):
    rows = flows[flows["family"] == "PortScan"].iloc[:5]
    for a in _score(scorer, rows):
        assert a["flow"]["truth"] == "PortScan"
        assert len(a["explanation"]) == 3
        assert {e["feature"] for e in a["explanation"]} <= set(scorer.features)
        assert a["model_version"] == Path(MODEL_DIR).name


@needs_models
def test_missing_features_are_scored_as_zero(scorer):
    assert scorer._matrix([{}]).tolist() == [[0.0] * len(scorer.features)]
    assert scorer.score([]) == []


@needs_models
def test_normal_traffic_does_not_read_as_drift(flows):
    # the regression: replaying only benign traffic turned the drift badge red
    s = Scorer()
    _score(s, flows[flows["family"] == "Benign"].sample(1500, random_state=1))
    out = s.drift()
    assert out["status"] == "stable", out
    assert out["alert_rate_status"] == "stable"


@needs_models
def test_known_attack_burst_does_not_move_the_drift_rate(flows):
    s = Scorer()
    _score(s, flows[flows["family"] == "Benign"].sample(1500, random_state=2))
    before = s.drift()["unexplained_alert_rate"]
    _score(s, flows[flows["family"] == "PortScan"].sample(300, random_state=2))
    after = s.drift()
    assert after["alert_rate"] > 0.1                        # the burst did alert
    assert after["unexplained_alert_rate"] <= before + 0.01  # but it is a named attack
    assert after["status"] != "drift"
    assert len(after["ks"]) > 0


# ── audit gaps 6, 10, 11: KS by importance, family mix, drift over time ────────

@needs_models
def test_drift_history_family_mix_and_ks_follow_the_config(flows):
    s = Scorer(drift_cfg={"history_every": 200, "top_features_ks": 3})
    benign = flows[flows["family"] == "Benign"].sample(700, random_state=3)
    for i in range(0, 700, 50):                       # batches, as the replayer sends them
        _score(s, benign.iloc[i:i + 50])
    _score(s, flows[flows["family"] == "DDoS"].sample(150, random_state=3))
    out = s.drift()
    # a snapshot at the first batch that takes the count past each multiple of 200
    assert [h["flows_scored"] for h in out["history"]] == [200, 400, 600, 850]
    assert out["history"][0]["status"] == "warming_up"            # < 500 benign flows seen
    assert out["history"][-1]["status"] in ("stable", "warning", "drift")
    # the DDoS burst shows up in the family mix, shares sum to one
    assert out["family_mix"].get("DDoS", 0) > 0.5
    assert abs(sum(out["family_mix"].values()) - 1) < 1e-3
    # KS on the classifier's top-3 features by importance, not on the most shifted
    assert {k["feature"] for k in out["ks"]} <= set(s.importance_rank[:3])
    assert out["flows_scored"] == 850


def test_drift_thresholds_come_from_the_config():
    import yaml as _yaml
    from api.services.scorer import drift_config
    cfg = _yaml.safe_load(open("ml/config.yaml"))["drift"]
    got = drift_config()
    for key in ("window", "warn_psi", "drift_psi", "alert_rate_warning_multiplier",
                "alert_rate_drift_multiplier", "top_features_ks"):
        assert got[key] == cfg[key]
