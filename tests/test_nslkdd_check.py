"""NSL-KDD sanity check (handbook t4): the loader, and the second way of computing
every metric, which is what catches a wrong number in ml/evaluate/metrics.py."""
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest
from sklearn.metrics import average_precision_score, roc_auc_score

from ml.evaluate import metrics

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("nslkdd_check", ROOT / "scripts" / "nslkdd_check.py")
check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check)

LABELS = ["normal", "neptune", "smurf", "ipsweep", "portsweep", "guess_passwd", "buffer_overflow"]


def write_nslkdd(path, n, rng, labels=LABELS, difficulty=True, header=False):
    """Rows in the NSL-KDD file layout. Feature values depend on the category so
    that a forest can learn something."""
    lines = [",".join(check.COLUMNS + ["label"] + (["difficulty"] if difficulty else []))] if header else []
    for i in range(n):
        label = labels[i % len(labels)]
        k = check.CLASSES.index(check.CATEGORY.get(label, "Benign"))
        row = [str(int(rng.integers(0, 10)) * k), ["tcp", "udp", "icmp"][k % 3],
               ["http", "private", "ftp_data", "telnet"][k % 4], ["SF", "S0", "REJ"][k % 3]]
        row += [f"{k * 10 + rng.normal():.2f}" for _ in check.COLUMNS[4:]]
        row.append(label)
        if difficulty:
            row.append(str(int(rng.integers(1, 22))))
        lines.append(",".join(row))
    path.write_text("\n".join(lines) + "\n")


def test_loader_maps_attacks_to_categories_with_and_without_difficulty(tmp_path):
    rng = np.random.default_rng(0)
    write_nslkdd(tmp_path / "a.txt", 70, rng)
    write_nslkdd(tmp_path / "b.csv", 70, rng, difficulty=False, header=True)
    for name in ("a.txt", "b.csv"):
        df = check.load(tmp_path / name)
        assert len(df) == 70
        assert set(df["family"]) == set(check.CLASSES)
        assert df.loc[df["label"] == "smurf", "family"].eq("DoS").all()
        assert df["src_bytes"].dtype.kind == "f"


def test_loader_refuses_unknown_attack_names(tmp_path):
    write_nslkdd(tmp_path / "x.txt", 10, np.random.default_rng(0), labels=["normal", "made_up"])
    with pytest.raises(ValueError, match="made_up"):
        check.load(tmp_path / "x.txt")


def test_test_file_categories_unseen_in_training_become_zero_columns(tmp_path):
    rng = np.random.default_rng(0)
    write_nslkdd(tmp_path / "train.txt", 30, rng, labels=["normal", "neptune"])
    write_nslkdd(tmp_path / "test.txt", 30, rng)            # has services/flags train lacks
    train, test = check.load(tmp_path / "train.txt"), check.load(tmp_path / "test.txt")
    x_train, x_test = check.encode(train, test)
    assert list(x_test.columns) == list(x_train.columns)


def test_rank_auc_and_average_precision_match_sklearn_with_ties():
    rng = np.random.default_rng(1)
    binary = rng.integers(0, 2, 500)
    score = np.round(rng.random(500) * 0.5 + binary * 0.3, 1)   # coarse: many ties
    assert check._roc_auc(binary, score) == pytest.approx(roc_auc_score(binary, score))
    assert check._average_precision(binary, score) == pytest.approx(average_precision_score(binary, score))


def _random_run(seed=0, n=800):
    rng = np.random.default_rng(seed)
    classes = check.CLASSES
    y = rng.choice(classes, size=n, p=[0.5, 0.25, 0.15, 0.08, 0.02])
    proba = rng.dirichlet(np.ones(len(classes)), size=n)
    for i, c in enumerate(classes):
        proba[y == c, i] += 0.6
    proba /= proba.sum(axis=1, keepdims=True)
    pred = np.array(classes)[proba.argmax(axis=1)]
    return y, pred, pred != "Benign", proba, classes


def test_summarise_agrees_with_the_independent_recomputation():
    run = _random_run()
    assert check.compare(metrics.summarise(*run), check.independent_metrics(*run)) == []


@pytest.mark.parametrize("field, tamper", [
    ("macro_f1", lambda s: s.__setitem__("macro_f1", s["macro_f1"] + 0.01)),
    ("false_positive_rate", lambda s: s.__setitem__("false_positive_rate", 0.5)),
    ("R2L recall", lambda s: s["per_class"]["R2L"].__setitem__("recall", 1.0)),
    ("U2R roc_auc", lambda s: s["auc"]["U2R"].__setitem__("roc_auc", 0.5)),
    ("confusion matrix", lambda s: s["confusion_matrix"]["rows"].reverse()),
])
def test_a_wrong_number_in_summarise_is_caught(field, tamper):
    run = _random_run()
    summary = metrics.summarise(*run)
    tamper(summary)
    bad = check.compare(summary, check.independent_metrics(*run))
    assert any(b.startswith(field) for b in bad), bad


def test_end_to_end_on_a_small_fixture(tmp_path):
    rng = np.random.default_rng(0)
    write_nslkdd(tmp_path / "KDDTrain+.txt", 700, rng)
    write_nslkdd(tmp_path / "KDDTest+.txt", 210, rng, labels=LABELS + ["mscan", "sqlattack"])
    out = tmp_path / "report.json"
    assert check.main(str(tmp_path), trees=10, out=str(out)) == 0
    report = json.loads(out.read_text())
    assert report["metrics_code_verified"] is True
    assert report["data"]["test_attack_types_not_in_train"] == ["mscan", "sqlattack"]
    for split in ("holdout_20pct_of_KDDTrain+", "KDDTest+"):
        assert report[split]["metric_mismatches"] == []
        assert "curves" not in report[split]["summary"]


def test_missing_data_exits_2_with_instructions(tmp_path, capsys):
    assert check.main(str(tmp_path), trees=10, out=str(tmp_path / "r.json")) == 2
    assert "KDDTrain+.txt" in capsys.readouterr().out
