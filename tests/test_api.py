from fastapi.testclient import TestClient
import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from api.main import app
from api.db.session import Base, get_db
from api.db.models import AlertModel
from api.routes.score import scorer_dependency
from api.services.scorer import ModelsNotFound
import uuid

# The tests get their own in-memory database. Writing to ./netwatch.db mixed test
# alerts into the demo's alert queue.
_engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                        poolclass=StaticPool)
Base.metadata.create_all(bind=_engine)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _test_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _test_db
client = TestClient(app)


class StubScorer:
    """Stands in for the trained models so the route contract is tested on any
    machine. Alerts on flows whose meta names a family; `features` are ignored."""

    def score(self, flows, metas=None):
        alerts = []
        for meta in metas or []:
            family = meta.get("stub_family")
            if not family:
                continue
            alerts.append({
                "id": f"alt_{uuid.uuid4().hex[:10]}",
                "timestamp": "2026-09-28T10:00:00Z",
                "flow": {k: str(v) for k, v in meta.items()},
                "prediction": {"family": family, "confidence": 0.9, "also_abnormal": False},
                "anomaly_score": 0.7,
                "is_novel": family == "Unknown",
                "severity": {"score": 80, "level": "High"},
                "explanation": [{"feature": "Flow Duration", "value": 1.0, "impact": 0.5}],
                "mitre": {"tactic": "Impact", "technique": "T1499"},
                "recommended_action": "Investigate",
                "status": "open",
                "analyst_label": None,
                "analyst_note": None,
                "model_version": "stub",
            })
        return alerts


@pytest.fixture(autouse=True)
def stub_scorer():
    from api.routes.score import _RECENT_ALERTS
    _RECENT_ALERTS.clear()
    app.dependency_overrides[scorer_dependency] = lambda: StubScorer()
    yield
    app.dependency_overrides.pop(scorer_dependency, None)


def flow(family=None, **meta):
    if family:
        meta["stub_family"] = family
    return {"features": {"Flow Duration": 12.0, "Total Fwd Packets": 3.0}, "meta": meta}


@pytest.fixture(scope="module")
def setup_alerts():
    app.dependency_overrides[scorer_dependency] = lambda: StubScorer()
    client.post("/score", json={"flows": [flow("DoS", dst_port=80), flow("BruteForce", dst_port=22),
                                          flow(None, dst_port=443)]})

@pytest.mark.parametrize("i", range(30))
def test_score_flow_load(i):
    # Simulate multiple rapid scoring requests
    response = client.post("/score", json={"flows": [flow("DoS", dst_port=80, n=i)]})
    assert response.status_code == 200

def test_score_response_shape():
    res = client.post("/score", json={"flows": [flow("DoS", dst_port="80"), flow(None)]})
    assert res.status_code == 200
    body = res.json()
    assert body["scored"] == 2
    assert len(body["alerts"]) == 1
    assert body["alerts"][0]["flow"]["dst_port"] == "80"

def test_model_inputs_are_stored_for_retraining_but_not_returned():
    class WithFeatures(StubScorer):
        def score(self, flows, metas=None):
            out = super().score(flows, metas)
            for a in out:
                a["features"] = {"Flow Duration": 12.0}
            return out
    app.dependency_overrides[scorer_dependency] = lambda: WithFeatures()
    res = client.post("/score", json={"flows": [flow("DoS")]})
    alert = res.json()["alerts"][0]
    assert "features" not in alert
    assert "features" not in client.get(f"/alerts/{alert['id']}").json()
    db = _TestSession()
    stored = db.query(AlertModel).filter(AlertModel.id == alert["id"]).first()
    assert stored.features == {"Flow Duration": 12.0}
    db.close()

def test_scored_alert_is_stored():
    res = client.post("/score", json={"flows": [flow("Bot", dst_port=6667)]})
    alert_id = res.json()["alerts"][0]["id"]
    assert client.get(f"/alerts/{alert_id}").json()["prediction"]["family"] == "Bot"

def test_rejected_label_survives_the_round_trip():
    class Rejecting(StubScorer):
        def score(self, flows, metas=None):
            out = super().score(flows, metas)
            for a in out:
                a["prediction"]["rejected_label"] = {"family": "DoS", "confidence": 0.99}
            return out
    app.dependency_overrides[scorer_dependency] = lambda: Rejecting()
    res = client.post("/score", json={"flows": [flow("Unknown")]})
    alert_id = res.json()["alerts"][0]["id"]
    stored = client.get(f"/alerts/{alert_id}").json()
    assert stored["is_novel"] is True
    assert stored["prediction"]["rejected_label"] == {"family": "DoS", "confidence": 0.99}

@pytest.mark.parametrize("body", [
    [{"dst_port": 80, "protocol": "TCP", "duration_ms": 1, "fwd_packets": 1, "bwd_packets": 1}],
    {"flows": [{"meta": {}}]},                              # no features
    {"flows": [{"features": {"Flow Duration": "fast"}}]},   # not a number
])
def test_score_rejects_malformed_requests(body):
    assert client.post("/score", json=body).status_code == 422

def test_score_without_trained_models_is_503():
    def missing():
        from api.routes.score import HTTPException
        raise HTTPException(status_code=503, detail=str(ModelsNotFound("run `make train` first")))
    app.dependency_overrides[scorer_dependency] = missing
    res = client.post("/score", json={"flows": [flow("DoS")]})
    assert res.status_code == 503
    assert "make train" in res.json()["detail"]

def test_replayer_payload_is_accepted():
    # the replayer and the API used to disagree on the request shape: every
    # replayed batch was a 422 and `make demo` could not run
    from replay.replayer import build_batch
    rows = pd.DataFrame({"Flow Duration": [10.0, 20.0], "Destination Port": [80, 22],
                         "family": ["DoS", "Benign"]})
    batch = build_batch(rows, ["Flow Duration"])
    res = client.post("/score", json={"flows": batch})
    assert res.status_code == 200
    assert res.json()["scored"] == 2

@pytest.mark.parametrize("page,size,expected_status", [
    (1, 10, 200),
    (2, 5, 200),
    (0, 10, 422),  # page < 1
    (1, 0, 422),   # size < 1
    (1, 101, 422), # size > 100
])
def test_get_alerts_pagination(setup_alerts, page, size, expected_status):
    res = client.get(f"/alerts?page={page}&size={size}")
    assert res.status_code == expected_status
    if expected_status == 200:
        data = res.json()
        assert "items" in data
        assert len(data["items"]) <= size

@pytest.mark.parametrize("severity_filter", ["Critical", "High", "Medium", "Low", "NonExistent"])
def test_get_alerts_filtering_severity(setup_alerts, severity_filter):
    res = client.get(f"/alerts?severity={severity_filter}")
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert item["severity"]["level"] == severity_filter

@pytest.mark.parametrize("family_filter", ["DoS", "BruteForce", "Benign", "Unknown"])
def test_get_alerts_filtering_family(setup_alerts, family_filter):
    res = client.get(f"/alerts?family={family_filter}")
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert item["prediction"]["family"] == family_filter

def test_alert_not_found():
    res = client.get(f"/alerts/alt_unknown_{uuid.uuid4().hex}")
    assert res.status_code == 404

def test_patch_alert_not_found():
    res = client.patch(f"/alerts/alt_unknown_{uuid.uuid4().hex}", json={"status": "escalated"})
    assert res.status_code == 404

@pytest.mark.parametrize("new_status,new_label,new_note", [
    ("escalated", "Confirmed DDoS", "Investigating"),
    ("false_positive", "Benign Traffic", "Just a scan"),
    (None, "Label Only", None),
    ("resolved", None, "Closed without label")
])
def test_patch_alert(setup_alerts, new_status, new_label, new_note):
    # First get an existing alert
    res = client.get("/alerts?size=1")
    items = res.json()["items"]
    if not items:
        pytest.skip("No alerts available to patch")

    alert_id = items[0]["id"]
    payload = {}
    if new_status: payload["status"] = new_status
    if new_label: payload["analyst_label"] = new_label
    if new_note: payload["analyst_note"] = new_note

    patch_res = client.patch(f"/alerts/{alert_id}", json=payload)
    assert patch_res.status_code == 200
    patched_data = patch_res.json()

    if new_status: assert patched_data["status"] == new_status
    if new_label: assert patched_data["analyst_label"] == new_label
    if new_note: assert patched_data["analyst_note"] == new_note


# ── /metrics/model, /metrics/drift, /models ──────────────────────────────────
# These used to return hardcoded numbers (macro-F1 0.92, drift always "Stable").

import json
from pathlib import Path
from api.routes import metrics as metrics_route


def test_model_metrics_is_the_training_report(tmp_path, monkeypatch):
    report = {"classifier": "lightgbm", "main": {"macro_f1": 0.8123}, "lofo": []}
    path = tmp_path / "metrics.json"
    path.write_text(json.dumps(report))
    monkeypatch.setattr(metrics_route, "REPORT_PATH", path)
    body = client.get("/metrics/model").json()
    assert body["main"]["macro_f1"] == 0.8123
    assert isinstance(body["synthetic_data"], bool)

def test_model_metrics_before_training_is_503(tmp_path, monkeypatch):
    monkeypatch.setattr(metrics_route, "REPORT_PATH", tmp_path / "missing.json")
    res = client.get("/metrics/model")
    assert res.status_code == 503
    assert "make train" in res.json()["detail"]

def test_drift_comes_from_the_scorer():
    class Drifting(StubScorer):
        def drift(self):
            return {"status": "warning", "flows_seen": 1234,
                    "top_features": [{"feature": "Flow Duration", "psi": 0.17}]}
    app.dependency_overrides[scorer_dependency] = lambda: Drifting()
    body = client.get("/metrics/drift").json()
    assert body["status"] == "warning"
    assert body["flows_seen"] == 1234
    assert body["bands"] == {"warning": 0.10, "drift": 0.25}

def test_drift_without_models_is_503():
    def missing():
        from api.routes.score import HTTPException
        raise HTTPException(status_code=503, detail="run `make train` first")
    app.dependency_overrides[scorer_dependency] = missing
    assert client.get("/metrics/drift").status_code == 503

@pytest.mark.skipif(not Path("models/v1/thresholds.json").exists(), reason="needs `make train`")
def test_models_reports_thresholds_and_triage_counts():
    before = client.get("/models").json()["feedback"]["escalated"]
    alert_id = client.post("/score", json={"flows": [flow("DoS")]}).json()["alerts"][0]["id"]
    client.patch(f"/alerts/{alert_id}", json={"status": "escalated"})
    body = client.get("/models").json()
    assert body["active"] == "v1"
    assert body["feedback"]["escalated"] == before + 1
    thresholds = json.load(open("models/v1/thresholds.json"))
    assert body["thresholds"]["fpr_budget"] == thresholds["fpr_budget"]
    assert set(body) >= {"active", "versions", "classifier", "thresholds", "feedback", "model_card"}


def test_active_release_figures_follow_the_report(tmp_path, monkeypatch):
    # the Models page showed release figures typed into the code; after a retrain
    # (e.g. on CICIDS2017) they would still show the synthetic numbers
    report = {"classifier": "lightgbm",
              "lofo": [{"family": "PortScan", "caught_by_full_system": 0.4321}],
              "novel_families": {"alerted": 0.5, "shown_as_unknown": 0.25}}
    path = tmp_path / "metrics.json"
    path.write_text(json.dumps(report))
    monkeypatch.setattr(metrics_route, "REPORT_PATH", path)
    if not Path(metrics_route.MODEL_DIR, "thresholds.json").exists():
        pytest.skip("needs `make train`")
    body = client.get("/models").json()
    active = next(v for v in body["version_history"] if v["status"] == "active")
    got = {h["label"]: h["after"] for h in active["highlights"]}
    assert got["Held-Out PortScan LOFO"] == "43.2%"
    assert got["Unseen Attacks Alerted"] == "50.0%"
    assert got["Unseen Shown as Unknown"] == "25.0%"
    assert "not separate models" in body["version_history_note"]


# ── audit gaps 13-16: status values, SQL filters, WebSocket, one MITRE map ──────
import asyncio
from datetime import datetime, timedelta

from api.routes.ws import ConnectionManager
from api.services.mitre import get_mitre_dict
from ml.models.combine import decide


def _insert(family, level, n, minutes=0):
    db = _TestSession()
    ids = []
    for i in range(n):
        aid = f"alt_{uuid.uuid4().hex[:10]}"
        db.add(AlertModel(
            id=aid, timestamp=datetime(2026, 9, 30, 10, 0) + timedelta(minutes=minutes + i),
            flow={}, prediction={"family": family, "confidence": 0.9},
            anomaly_score=0.5, is_novel=False, severity={"score": 50, "level": level},
            explanation=[], mitre=get_mitre_dict(family), recommended_action="x",
            status="open", model_version="test"))
        ids.append(aid)
    db.commit(); db.close()
    return ids


def test_unknown_status_is_refused_and_nothing_changes():
    aid = _insert("DoS", "High", 1)[0]
    res = client.patch(f"/alerts/{aid}", json={"status": "totally_made_up"})
    assert res.status_code == 422
    assert client.get(f"/alerts/{aid}").json()["status"] == "open"


@pytest.mark.parametrize("status", ["open", "acknowledged", "escalated", "false_positive", "resolved"])
def test_every_handbook_status_is_accepted(status):
    aid = _insert("DoS", "High", 1)[0]
    assert client.patch(f"/alerts/{aid}", json={"status": status}).json()["status"] == status


def test_filters_count_and_page_in_the_database():
    fam = f"Fam{uuid.uuid4().hex[:6]}"                 # unique, so other tests' rows don't count
    low = _insert(fam, "Low", 7)
    _insert(fam, "Critical", 3, minutes=100)
    all_rows = client.get(f"/alerts?family={fam}&size=100").json()
    assert all_rows["total"] == 10
    only_low = client.get(f"/alerts?family={fam}&severity=Low&size=100").json()
    assert only_low["total"] == 7 and {a["id"] for a in only_low["items"]} == set(low)
    p1 = client.get(f"/alerts?family={fam}&page=1&size=4").json()
    p3 = client.get(f"/alerts?family={fam}&page=3&size=4").json()
    assert p1["total"] == p3["total"] == 10
    assert len(p1["items"]) == 4 and len(p3["items"]) == 2
    assert p1["items"][0]["severity"]["level"] == "Critical"      # newest first


def test_broadcast_drops_a_connection_that_fails():
    class Dead:
        async def send_json(self, m): raise RuntimeError("closed")
    class Alive:
        def __init__(self): self.got = []
        async def send_json(self, m): self.got.append(m)
    mgr, dead, alive = ConnectionManager(), Dead(), Alive()
    mgr.active_connections += [dead, alive]
    asyncio.run(mgr.broadcast({"id": 1}))
    asyncio.run(mgr.broadcast({"id": 2}))
    assert mgr.active_connections == [alive] and len(alive.got) == 2
    mgr.disconnect(dead)                                           # already gone: no error


def test_one_mitre_map():
    # decide() no longer maps families; the scorer attaches api/services/mitre.py
    out = decide(0.99, "DoS", 0.99, 0.2, 0.2, False, 0.5)
    assert "mitre" not in out
    assert get_mitre_dict("DoS")["technique_id"] == "T1499"      # endpoint DoS (Hulk, slowloris)
    assert get_mitre_dict("DDoS")["technique_id"] == "T1498"     # network flood


def test_drift_reports_the_analyst_false_positive_share():
    from api.services.drift_service import false_positive_share
    ids = _insert(f"Fam{uuid.uuid4().hex[:6]}", "High", 4, minutes=10_000)   # the newest alerts
    client.patch(f"/alerts/{ids[0]}", json={"status": "false_positive"})
    db = _TestSession()
    fp = false_positive_share(db, last_n=4)
    db.close()
    assert fp == {"share": 0.25, "false_positives": 1, "alerts": 4}
    class Drifting(StubScorer):
        def drift(self):
            return {"status": "stable", "history": []}
    app.dependency_overrides[scorer_dependency] = lambda: Drifting()
    body = client.get("/metrics/drift").json()
    assert set(body["fp_share"]) == {"share", "false_positives", "alerts"}
    assert body["history"] == []
