import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

# One alert store per checkout, whatever directory the API is started from, so
# scripts/retrain.py reads the same file the API writes. NETWATCH_DB overrides.
DB_PATH = Path(os.environ.get("NETWATCH_DB",
                              Path(__file__).resolve().parents[2] / "netwatch.db"))

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker, declarative_base

    SQLALCHEMY_AVAILABLE = True
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    SQLALCHEMY_DATABASE_URL = str(DB_PATH)

    class _ColumnExpr:
        def __init__(self, name: str):
            self.name = name

        def __eq__(self, other: Any):  # type: ignore[override]
            return ("eq", self.name, other)

        def desc(self):
            return ("desc", self.name)

    class _Metadata:
        def create_all(self, bind: Any = None):
            conn = sqlite3.connect(bind or SQLALCHEMY_DATABASE_URL, check_same_thread=False)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    flow TEXT,
                    prediction TEXT,
                    anomaly_score REAL,
                    is_novel INTEGER,
                    severity TEXT,
                    explanation TEXT,
                    mitre TEXT,
                    recommended_action TEXT,
                    status TEXT DEFAULT 'open',
                    analyst_label TEXT,
                    analyst_note TEXT,
                    model_version TEXT,
                    features TEXT
                )
                """
            )
            conn.commit()
            conn.close()

    class Base:
        metadata = _Metadata()

    engine = SQLALCHEMY_DATABASE_URL

    class _SqliteQuery:
        def __init__(self, session: "SqliteSession", target: Any):
            self._session = session
            self._target = target
            self._filters: List[tuple] = []

        def filter(self, cond: Any):
            if isinstance(cond, tuple) and len(cond) == 3:
                self._filters.append(cond)
            return self

        def order_by(self, clause: Any):
            return self

        def all(self) -> List[Any]:
            from .models import AlertModel

            cur = self._session._conn.cursor()
            where_clauses = []
            params = []
            for op, col, val in self._filters:
                if op == "eq":
                    where_clauses.append(f"{col} = ?")
                    params.append(val)
            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            if isinstance(self._target, _ColumnExpr):
                cur.execute(
                    f"SELECT {self._target.name} FROM alerts {where_sql} ORDER BY timestamp DESC",
                    params,
                )
                return [(row[0],) for row in cur.fetchall()]

            cur.execute(
                f"""
                SELECT id, timestamp, flow, prediction, anomaly_score, is_novel,
                       severity, explanation, mitre, recommended_action, status,
                       analyst_label, analyst_note, model_version
                FROM alerts {where_sql}
                ORDER BY timestamp DESC
                """,
                params,
            )
            rows = cur.fetchall()
            out = []
            for r in rows:
                ts_raw = r[1]
                if isinstance(ts_raw, str):
                    ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).replace(tzinfo=None)
                else:
                    ts = ts_raw or datetime.utcnow()
                obj = AlertModel(
                    id=r[0],
                    timestamp=ts,
                    flow=json.loads(r[2]) if r[2] else {},
                    prediction=json.loads(r[3]) if r[3] else {},
                    anomaly_score=float(r[4]) if r[4] is not None else 0.0,
                    is_novel=bool(r[5]),
                    severity=json.loads(r[6]) if r[6] else {},
                    explanation=json.loads(r[7]) if r[7] else [],
                    mitre=json.loads(r[8]) if r[8] else {},
                    recommended_action=r[9],
                    status=r[10] or "open",
                    analyst_label=r[11],
                    analyst_note=r[12],
                    model_version=r[13] or "v1",
                )
                self._session._tracked.append(obj)
                out.append(obj)
            return out

        def first(self) -> Optional[Any]:
            items = self.all()
            return items[0] if items else None

    class SqliteSession:
        def __init__(self, db_path: str = SQLALCHEMY_DATABASE_URL):
            Base.metadata.create_all(bind=db_path)
            self._conn = sqlite3.connect(db_path, check_same_thread=False)
            self._pending: List[Any] = []
            self._tracked: List[Any] = []

        def add(self, obj: Any):
            self._pending.append(obj)
            self._tracked.append(obj)

        def query(self, target: Any) -> _SqliteQuery:
            return _SqliteQuery(self, target)

        def commit(self):
            cur = self._conn.cursor()
            for obj in self._tracked:
                ts = obj.timestamp
                if isinstance(ts, datetime):
                    ts_str = ts.replace(tzinfo=None).isoformat()
                else:
                    ts_str = str(ts)
                cur.execute(
                    """
                    INSERT OR REPLACE INTO alerts (
                        id, timestamp, flow, prediction, anomaly_score, is_novel,
                        severity, explanation, mitre, recommended_action, status,
                        analyst_label, analyst_note, model_version, features
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        obj.id,
                        ts_str,
                        json.dumps(obj.flow or {}),
                        json.dumps(obj.prediction or {}),
                        float(obj.anomaly_score or 0.0),
                        1 if obj.is_novel else 0,
                        json.dumps(obj.severity or {}),
                        json.dumps(obj.explanation or []),
                        json.dumps(obj.mitre or {}),
                        obj.recommended_action,
                        obj.status or "open",
                        obj.analyst_label,
                        obj.analyst_note,
                        obj.model_version or "v1",
                        json.dumps(getattr(obj, "features", None)),
                    ),
                )
            self._conn.commit()
            self._pending.clear()

        def refresh(self, obj: Any):
            return obj

        def close(self):
            self._conn.close()

    def SessionLocal():
        return SqliteSession(SQLALCHEMY_DATABASE_URL)


def ensure_schema(db_path: Path = DB_PATH) -> None:
    """Add columns introduced after a database was first created.

    create_all() makes missing tables but never alters existing ones, so an
    alert store from before `features` or `flow_count` existed would fail on
    every insert.
    """
    if not Path(db_path).exists():
        return
    conn = sqlite3.connect(str(db_path))
    try:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(alerts)")}
        if cols and "features" not in cols:
            conn.execute("ALTER TABLE alerts ADD COLUMN features JSON")
        if cols and "flow_count" not in cols:
            conn.execute("ALTER TABLE alerts ADD COLUMN flow_count INTEGER DEFAULT 1")
        conn.commit()
    finally:
        conn.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
