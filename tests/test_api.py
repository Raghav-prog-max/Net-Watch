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


@pytest.fixture(scope="module", autouse=True)
def no_api_key():
    """The tests below call the write endpoints without a key; a NETWATCH_API_KEY
    in the developer's shell must not turn them into 401s."""
    with pytest.MonkeyPatch.context() as mp:
        mp.delenv("NETWATCH_API_KEY", raising=False)
        yield


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
    assert stored.features == [{"Flow Duration": 12.0}]
    db.close()

def test_scored_alert_is_stored():
    res = client.post("/score", json={"flows": [flow("Bot", dst_port=6667)]})
    alert_id = res.json()["alerts"][0]["id"]
    assert client.get(f"/alerts/{alert_id}").json()["prediction"]["family"] == "Bot"

def test_grouped_alert_update_returns_a_valid_timestamp():
    """A repeat of the same family within 60 s is folded into the first alert,
    and re-sent once 5 s have passed. That update was built with
    ts.isoformat() + "Z" on an aware datetime ("...+00:00Z"), which the
    response model rejects, so POST /score returned 500 during every replay."""
    times = iter(["2026-09-28T10:00:00Z", "2026-09-28T10:00:06Z"])

    class Ticking(StubScorer):
        def score(self, flows, metas=None):
            out = super().score(flows, metas)
            for a in out:
                a["timestamp"] = next(times)
            return out
    app.dependency_overrides[scorer_dependency] = lambda: Ticking()

    first = client.post("/score", json={"flows": [flow("PortScan")]})
    again = client.post("/score", json={"flows": [flow("PortScan")]})
    assert again.status_code == 200, again.text
    update = again.json()["alerts"][0]
    assert update["id"] == first.json()["alerts"][0]["id"]
    assert update["flow_count"] == 2
    assert update["timestamp"].startswith("2026-09-28T10:00:06")
    stored = client.get(f"/alerts/{update['id']}").json()
    assert stored["flow_count"] == 2

def test_every_flow_in_a_batch_is_counted_in_its_group():
    """The replayer sends 20 flows per request. The first alert of a family
    creates the group, but the session does not autoflush, so the rest of that
    family in the same request could not find it and were skipped: a novel
    replay counted 525 Unknown flows out of 544."""
    batch = [flow("PortScan"), flow("PortScan"), flow("DoS"), flow("PortScan")]
    res = client.post("/score", json={"flows": batch})
    assert res.status_code == 200, res.text
    alerts = {a["prediction"]["family"]: a for a in res.json()["alerts"]}
    assert set(alerts) == {"PortScan", "DoS"}, "one alert per family"
    assert alerts["PortScan"]["flow_count"] == 3
    assert alerts["DoS"]["flow_count"] == 1
    for family, n in (("PortScan", 3), ("DoS", 1)):
        assert client.get(f"/alerts/{alerts[family]['id']}").json()["flow_count"] == n
    assert res.json()["alerted"] == 4, "the alert rate counts flows, not alerts"

def test_alert_list_carries_the_flow_count():
    """GET /alerts built its items from a dict without flow_count; the code that
    added it sat after the return and never ran."""
    res = client.post("/score", json={"flows": [flow("Bot"), flow("Bot")]})
    alert_id = res.json()["alerts"][0]["id"]
    items = client.get("/alerts", params={"family": "Bot", "size": 100}).json()["items"]
    assert {a["id"]: a for a in items}[alert_id]["flow_count"] == 2

def test_flows_after_triage_open_a_new_alert():
    """A DDoS alert marked false positive kept absorbing the DDoS flows that
    followed, so a live attack stayed hidden inside a dismissed alert."""
    first = client.post("/score", json={"flows": [flow("DDoS")]}).json()["alerts"][0]
    client.patch(f"/alerts/{first['id']}", json={"status": "false_positive"})
    again = client.post("/score", json={"flows": [flow("DDoS"), flow("DDoS")]}).json()["alerts"]
    assert [a["id"] for a in again] != [first["id"]]
    assert again[0]["status"] == "open" and again[0]["flow_count"] == 2
    dismissed = client.get(f"/alerts/{first['id']}").json()
    assert dismissed["status"] == "false_positive" and dismissed["flow_count"] == 1

@pytest.mark.parametrize("status", ["acknowledged", "escalated", "resolved"])
def test_any_triage_closes_the_group(status):
    first = client.post("/score", json={"flows": [flow("WebAttack")]}).json()["alerts"][0]
    client.patch(f"/alerts/{first['id']}", json={"status": status})
    again = client.post("/score", json={"flows": [flow("WebAttack")]}).json()["alerts"]
    assert len(again) == 1 and again[0]["id"] != first["id"]

def test_an_alert_shows_its_most_severe_flow():
    """The group kept its first flow's severity, so a Critical flow joining a
    Low alert stayed listed as Low."""
    class BySeverity(StubScorer):
        def score(self, flows, metas=None):
            out = super().score(flows, metas)
            for a, m in zip(out, [m for m in metas if m.get("stub_family")]):
                a["severity"] = {"score": int(m["score"]), "level": m["level"]}
                a["explanation"] = [{"feature": m["level"], "value": 1.0, "impact": 1.0}]
            return out
    app.dependency_overrides[scorer_dependency] = lambda: BySeverity()
    batch = [flow("DoS", score=30, level="Low"), flow("DoS", score=95, level="Critical"),
             flow("DoS", score=50, level="Medium")]
    alert = client.post("/score", json={"flows": batch}).json()["alerts"][0]
    stored = client.get(f"/alerts/{alert['id']}").json()
    for a in (alert, stored):
        assert a["severity"] == {"score": 95, "level": "Critical"}
        assert a["explanation"][0]["feature"] == "Critical"
        assert a["flow_count"] == 3
    # a later rise is re-sent at once, not after the 5 s throttle; no rise, no re-send
    assert client.post("/score", json={"flows": [flow("DoS", score=20, level="Low")]}).json()["alerts"] == []
    bump = client.post("/score", json={"flows": [flow("DoS", score=99, level="Critical")]}).json()["alerts"]
    assert [(a["id"], a["severity"]["score"], a["flow_count"]) for a in bump] == [(alert["id"], 99, 5)]

def test_a_resent_alert_keeps_what_the_analyst_wrote():
    """A growing alert was re-sent built from the newest flow: status "open" and
    no note, so the dashboard wiped the analyst's work on screen."""
    times = iter(["2026-09-28T10:00:00Z", "2026-09-28T10:00:06Z"])

    class Ticking(StubScorer):
        def score(self, flows, metas=None):
            out = super().score(flows, metas)
            for a in out:
                a["timestamp"] = next(times)
            return out
    app.dependency_overrides[scorer_dependency] = lambda: Ticking()
    first = client.post("/score", json={"flows": [flow("BruteForce")]}).json()["alerts"][0]
    client.patch(f"/alerts/{first['id']}", json={"analyst_note": "watching this host"})
    update = client.post("/score", json={"flows": [flow("BruteForce")]}).json()["alerts"][0]
    assert update["id"] == first["id"]
    assert update["analyst_note"] == "watching this host"
    assert update["flow_count"] == 2

def test_a_group_keeps_model_inputs_for_retraining(monkeypatch):
    """Only the first flow's inputs were stored, so a false positive on a
    burst of 500 flows gave retraining one row."""
    from api.routes import score as score_route
    monkeypatch.setattr(score_route, "MAX_GROUP_SAMPLES", 2)

    class WithFeatures(StubScorer):
        def score(self, flows, metas=None):
            out = super().score(flows, metas)
            for i, a in enumerate(out):
                a["features"] = {"Flow Duration": float(i)}
            return out
    app.dependency_overrides[scorer_dependency] = lambda: WithFeatures()
    res = client.post("/score", json={"flows": [flow("PortScan")] * 3})
    db = _TestSession()
    stored = db.query(AlertModel).filter(AlertModel.id == res.json()["alerts"][0]["id"]).first()
    assert stored.flow_count == 3
    assert stored.features == [{"Flow Duration": 0.0}, {"Flow Duration": 1.0}], "capped"
    db.close()

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


# ── NETWATCH_API_KEY on the write endpoints (api/services/auth.py) ──────────
# Unlabelled writes poison retraining: a false_positive label makes the flow a
# Benign training row (scripts/retrain.py).

@pytest.fixture
def api_key(monkeypatch):
    key = "test-" + uuid.uuid4().hex
    monkeypatch.setenv("NETWATCH_API_KEY", key)
    return key


@pytest.mark.parametrize("headers", [{}, {"X-API-Key": "wrong"}])
def test_score_needs_the_key_when_set(api_key, headers):
    res = client.post("/score", json={"flows": [flow("DoS")]}, headers=headers)
    assert res.status_code == 401


def test_score_accepts_the_key(api_key):
    res = client.post("/score", json={"flows": [flow("DoS")]}, headers={"X-API-Key": api_key})
    assert res.status_code == 200


@pytest.mark.parametrize("headers", [{}, {"X-API-Key": "wrong"}])
def test_triage_needs_the_key_when_set(setup_alerts, api_key, headers):
    alert_id = client.get("/alerts?size=1").json()["items"][0]["id"]
    res = client.patch(f"/alerts/{alert_id}", json={"status": "false_positive"}, headers=headers)
    assert res.status_code == 401


def test_rejected_triage_changes_nothing(setup_alerts, api_key):
    alert_id = client.get("/alerts?size=1").json()["items"][0]["id"]
    before = client.get(f"/alerts/{alert_id}").json()
    client.patch(f"/alerts/{alert_id}", json={"status": "false_positive", "analyst_note": "x"})
    after = client.get(f"/alerts/{alert_id}").json()
    assert (after["status"], after["analyst_note"]) == (before["status"], before["analyst_note"])


def test_triage_accepts_the_key(setup_alerts, api_key):
    alert_id = client.get("/alerts?size=1").json()["items"][0]["id"]
    res = client.patch(f"/alerts/{alert_id}", json={"status": "acknowledged"},
                       headers={"X-API-Key": api_key})
    assert res.status_code == 200
    assert res.json()["status"] == "acknowledged"


def test_reads_stay_open_with_a_key(setup_alerts, api_key):
    assert client.get("/alerts").status_code == 200


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


# ------------------------------------------------------------------------ CORS

def test_allowed_origins_parses_the_env_var():
    from api.main import allowed_origins
    assert allowed_origins(None) == ["*"]
    assert allowed_origins("") == ["*"]
    assert allowed_origins("https://a.example, https://b.example,") == ["https://a.example",
                                                                        "https://b.example"]


def test_any_origin_may_read_the_api_but_never_with_credentials():
    """It allowed every origin *with* credentials: any site could call the API
    with a visitor's cookies."""
    res = client.get("/", headers={"Origin": "https://elsewhere.example"})
    assert res.headers["access-control-allow-origin"] == "*"
    assert "access-control-allow-credentials" not in res.headers


# ------------------------------------------------------------- GET /metrics

def _metric(text, name):
    import re
    m = re.search(rf"^{re.escape(name)} (\S+)$", text, re.M)
    return float(m.group(1)) if m else 0.0


def test_metrics_count_scored_flows_alerts_and_latency():
    """Prometheus scraped /metrics before it existed: every target was down and
    the Grafana dashboard empty."""
    before = client.get("/metrics").text
    client.post("/score", json={"flows": [flow("DDoS"), flow("DDoS"), flow(None)]})
    after = client.get("/metrics")
    assert after.status_code == 200
    assert after.headers["content-type"].startswith("text/plain; version=0.0.4")
    delta = lambda name: _metric(after.text, name) - _metric(before, name)
    assert delta("netwatch_flows_scored_total") == 3
    assert delta("netwatch_flows_alerted_total") == 2
    assert delta('netwatch_alerts_opened_total{family="DDoS"}') == 1, "a burst is one alert"
    assert delta("netwatch_score_request_seconds_count") == 1
    assert _metric(after.text, 'netwatch_alerts{status="open"}') >= 1
    assert "_created" not in after.text


def test_metrics_report_drift_and_need_no_models():
    from api.routes.metrics import optional_scorer

    class Drifting:
        drift_cfg = {"warn_psi": 0.1, "drift_psi": 0.25, "fp_share_alerts": 500}

        def drift(self):
            return {"status": "warning", "top_features": [{"feature": "Flow Duration", "psi": 0.17}],
                    "unexplained_alert_rate": 0.002, "baseline_unexplained_alert_rate": 0.001,
                    "flows_seen": 4200}
    app.dependency_overrides[optional_scorer] = lambda: Drifting()
    try:
        text = client.get("/metrics").text
    finally:
        app.dependency_overrides.pop(optional_scorer, None)
    assert _metric(text, 'netwatch_drift_status{status="warning"}') == 1
    assert _metric(text, 'netwatch_drift_status{status="drift"}') == 0
    assert _metric(text, "netwatch_drift_max_psi") == 0.17
    assert _metric(text, "netwatch_drift_flows_seen") == 4200

    app.dependency_overrides[optional_scorer] = lambda: None     # before `make train`
    try:
        res = client.get("/metrics")
    finally:
        app.dependency_overrides.pop(optional_scorer, None)
    assert res.status_code == 200 and "netwatch_flows_scored_total" in res.text
    assert "netwatch_drift_status" not in res.text
