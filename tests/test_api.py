from fastapi.testclient import TestClient
import pytest
from api.main import app
import uuid

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_alerts():
    # Insert a few alerts for GET tests
    flows = [
        {"dst_port": 80, "protocol": "TCP", "duration_ms": 12, "fwd_packets": 3, "bwd_packets": 0},
        {"dst_port": 22, "protocol": "TCP", "duration_ms": 1200, "fwd_packets": 10, "bwd_packets": 10},
        {"dst_port": 443, "protocol": "TCP", "duration_ms": 50, "fwd_packets": 5, "bwd_packets": 5} # Benign, might be dropped
    ]
    client.post("/score", json=flows)

@pytest.mark.parametrize("i", range(30))
def test_score_flow_load(i):
    # Simulate multiple rapid scoring requests
    flow = {"dst_port": 80, "protocol": "TCP", "duration_ms": i, "fwd_packets": i*2, "bwd_packets": i}
    response = client.post("/score", json=[flow])
    assert response.status_code == 200

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
