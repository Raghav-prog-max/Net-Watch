"""Analyst feedback has to reach the next model (handbook: retraining path)."""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.db.session import ensure_schema
from ml.data.labels import TRAIN_FAMILIES
from scripts.retrain import training_label


def test_false_positive_teaches_benign_whatever_the_label_text():
    # the dashboard labels false positives "Analyst FP"; that must not become a class
    assert training_label("false_positive", "Analyst FP", TRAIN_FAMILIES) == "Benign"
    assert training_label("false_positive", None, TRAIN_FAMILIES) == "Benign"


def test_a_family_name_is_learned_free_text_is_not():
    assert training_label("escalated", "DDoS", TRAIN_FAMILIES) == "DDoS"
    assert training_label("escalated", "Confirmed DDoS", TRAIN_FAMILIES) is None
    assert training_label("resolved", "Unknown", TRAIN_FAMILIES) is None
    assert training_label("open", None, TRAIN_FAMILIES) is None


def test_old_alert_store_gains_the_features_column(tmp_path):
    db = tmp_path / "old.db"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE alerts (id TEXT PRIMARY KEY, status TEXT)")
    conn.commit(); conn.close()
    ensure_schema(db)
    ensure_schema(db)                     # idempotent
    cols = {r[1] for r in sqlite3.connect(db).execute("PRAGMA table_info(alerts)")}
    assert "features" in cols
