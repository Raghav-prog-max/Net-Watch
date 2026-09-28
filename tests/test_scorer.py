from pathlib import Path

import pandas as pd
import pytest
import yaml

from api.services.scorer import MODEL_DIR, ModelsNotFound, Scorer, severity_logic
from api.services.mitre import get_mitre_dict

@pytest.mark.parametrize("family,confidence,anomaly_pct,expected_level", [
    ("DDoS", 1.0, 1.0, "Critical"),     # 100 * (0.5*1 + 0.3*1 + 0.2*1) = 100 >= 85 -> Critical
    ("DDoS", 0.0, 0.0, "Low"),          # 100 * (0 + 0 + 0.2) = 20 -> Low
    ("DDoS", 0.9, 0.8, "Critical"),     # 100 * (0.45 + 0.24 + 0.2) = 89
    ("DDoS", 0.5, 0.5, "Medium"),       # 100 * (0.25 + 0.15 + 0.2) = 60
    ("PortScan", 1.0, 1.0, "Critical"), # 100 * (0.5 + 0.3 + 0.1) = 90
    ("PortScan", 0.5, 0.5, "Medium"),   # 100 * (0.25 + 0.15 + 0.1) = 50
    ("Unknown", 1.0, 1.0, "Critical"),  # 100 * (0.5 + 0.3 + 0.16) = 96
    ("Benign", 0.99, 0.1, "Medium"),    # 100 * (0.495 + 0.03 + 0.1) = 62.5 -> Medium
    ("Benign", 1.0, 1.0, "Critical"),   # 100 * (0.5 + 0.3 + 0.1) = 90 -> Critical
])
def test_severity_logic_boundaries(family, confidence, anomaly_pct, expected_level):
    score, level = severity_logic(confidence, anomaly_pct, family)
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
