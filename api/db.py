"""Alert storage. SQLite by default so the demo runs with no services to start."""
import json
import sqlite3
from pathlib import Path

DB_PATH = Path("data/alerts.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  family TEXT NOT NULL,
  severity INTEGER NOT NULL,
  level TEXT NOT NULL,
  is_novel INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  analyst_label TEXT,
  analyst_note TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(timestamp DESC);
"""


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def insert(conn, alert: dict):
    conn.execute(
        "INSERT INTO alerts (id,timestamp,family,severity,level,is_novel,status,payload)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (alert["id"], alert["timestamp"], alert["prediction"]["family"],
         alert["severity"]["score"], alert["severity"]["level"],
         int(alert["is_novel"]), alert["status"], json.dumps(alert)))
    conn.commit()


def query(conn, severity=None, status=None, family=None, limit=100, offset=0):
    sql = "SELECT payload FROM alerts WHERE 1=1"
    args = []
    if severity:
        sql += " AND level = ?"; args.append(severity)
    if status:
        sql += " AND status = ?"; args.append(status)
    if family:
        sql += " AND family = ?"; args.append(family)
    sql += " ORDER BY severity DESC, timestamp DESC LIMIT ? OFFSET ?"
    args += [limit, offset]
    return [json.loads(r["payload"]) for r in conn.execute(sql, args)]


def get(conn, alert_id):
    row = conn.execute("SELECT payload FROM alerts WHERE id = ?", (alert_id,)).fetchone()
    return json.loads(row["payload"]) if row else None


def triage(conn, alert_id, status, label=None, note=None):
    alert = get(conn, alert_id)
    if not alert:
        return None
    alert.update({"status": status, "analyst_label": label, "analyst_note": note})
    conn.execute("UPDATE alerts SET status=?, analyst_label=?, analyst_note=?, payload=?"
                 " WHERE id = ?",
                 (status, label, note, json.dumps(alert), alert_id))
    conn.commit()
    return alert


def feedback_counts(conn):
    rows = conn.execute("SELECT status, COUNT(*) c FROM alerts GROUP BY status").fetchall()
    return {r["status"]: r["c"] for r in rows}
