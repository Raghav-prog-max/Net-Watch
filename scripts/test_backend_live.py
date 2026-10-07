import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from api.main import app
from api.services.scorer import get_scorer

def run_integration_checks():
    client = TestClient(app)
    results = {}
    
    # 1. Health check
    res = client.get("/")
    assert res.status_code == 200, f"Root returned {res.status_code}"
    results["root_health"] = res.json()
    print(" [1/8] Root health check passed")

    # 2. Auth enforcement on /score
    res_no_auth = client.post("/score", json={"flows": []})
    assert res_no_auth.status_code == 403, f"Expected 403 without auth, got {res_no_auth.status_code}"
    print(" [2/8] API Auth check passed (403 on missing key)")

    # 3. Model & Scorer loading
    scorer = get_scorer()
    assert scorer is not None
    assert scorer.version == "2.1"
    print(f" [3/8] Scorer loaded model version {scorer.version} successfully")

    # 4. Scoring a real flow batch
    headers = {"X-API-Key": "netwatch-demo-key"}
    test_flow = {
        "features": {
            "Destination Port": 80,
            "Flow Duration": 500000,
            "Total Fwd Packets": 10,
            "Total Backward Packets": 8,
            "Total Length of Fwd Packets": 1500,
            "Total Length of Bwd Packets": 4000,
            "Fwd Packet Length Max": 500,
            "Fwd Packet Length Min": 40,
            "Fwd Packet Length Mean": 150,
            "Fwd Packet Length Std": 20,
            "Bwd Packet Length Max": 1000,
            "Bwd Packet Length Min": 40,
            "Bwd Packet Length Mean": 500,
            "Bwd Packet Length Std": 50,
            "Flow Bytes/s": 11000,
            "Flow Packets/s": 36,
            "Flow IAT Mean": 25000,
            "Flow IAT Std": 5000,
            "Flow IAT Max": 100000,
            "Flow IAT Min": 1000,
            "Fwd IAT Total": 400000,
            "Fwd IAT Mean": 44444,
            "Fwd IAT Std": 8000,
            "Fwd IAT Max": 90000,
            "Fwd IAT Min": 1000,
            "Bwd IAT Total": 450000,
            "Bwd IAT Mean": 64285,
            "Bwd IAT Std": 9000,
            "Bwd IAT Max": 95000,
            "Bwd IAT Min": 1000,
            "Fwd PSH Flags": 0,
            "Fwd URG Flags": 0,
            "Fwd Header Length": 320,
            "Bwd Header Length": 256,
            "Fwd Packets/s": 20,
            "Bwd Packets/s": 16,
            "Min Packet Length": 40,
            "Max Packet Length": 1000,
            "Packet Length Mean": 305,
            "Packet Length Std": 120,
            "Packet Length Variance": 14400,
            "FIN Flag Count": 0,
            "SYN Flag Count": 1,
            "RST Flag Count": 0,
            "PSH Flag Count": 0,
            "ACK Flag Count": 1,
            "URG Flag Count": 0,
            "CWE Flag Count": 0,
            "ECE Flag Count": 0,
            "Down/Up Ratio": 0.8,
            "Average Packet Size": 305,
            "Avg Fwd Segment Size": 150,
            "Avg Bwd Segment Size": 500,
            "Fwd Header Length.1": 320,
            "Subflow Fwd Packets": 10,
            "Subflow Fwd Bytes": 1500,
            "Subflow Bwd Packets": 8,
            "Subflow Bwd Bytes": 4000,
            "Init_Win_bytes_forward": 29200,
            "Init_Win_bytes_backward": 28960,
            "act_data_pkt_fwd": 5,
            "min_seg_size_forward": 32,
            "Active Mean": 0,
            "Active Std": 0,
            "Active Max": 0,
            "Active Min": 0,
            "Idle Mean": 0,
            "Idle Std": 0,
            "Idle Max": 0,
            "Idle Min": 0
        },
        "meta": {
            "src_ip": "192.168.1.100",
            "dst_ip": "10.0.0.1",
            "dst_port": 80,
            "protocol": "TCP"
        }
    }
    score_res = client.post("/score", json={"flows": [test_flow]}, headers=headers)
    assert score_res.status_code == 200, f"/score failed: {score_res.text}"
    score_data = score_res.json()
    assert "scored" in score_data
    assert score_data["scored"] == 1
    print(f" [4/8] /score succeeded! Scored: {score_data['scored']}, Alerted: {score_data['alerted']}")

    # 5. Alerts retrieval and filtering
    alerts_res = client.get("/alerts?page=1&size=10")
    assert alerts_res.status_code == 200, f"/alerts failed: {alerts_res.text}"
    alerts_data = alerts_res.json()
    assert "items" in alerts_data
    assert "total" in alerts_data
    print(f" [5/8] /alerts succeeded! Found {alerts_data['total']} alerts in store")

    # 6. Triage feedback (PATCH /alerts/{id}) if any alerts exist
    if alerts_data["items"]:
        sample_alert = alerts_data["items"][0]
        alert_id = sample_alert["id"]
        patch_res = client.patch(
            f"/alerts/{alert_id}",
            json={"status": "acknowledged", "analyst_note": "Verified by integration check"},
            headers=headers
        )
        assert patch_res.status_code == 200, f"PATCH /alerts/{alert_id} failed: {patch_res.text}"
        updated_alert = patch_res.json()
        assert updated_alert["status"] == "acknowledged"
        assert updated_alert["analyst_note"] == "Verified by integration check"
        print(f" [6/8] PATCH /alerts/{alert_id} triage update succeeded!")
    else:
        print(" [6/8] Skipping PATCH (no alert generated for sample flow)")

    # 7. Drift metrics (GET /metrics/drift)
    drift_res = client.get("/metrics/drift")
    assert drift_res.status_code == 200, f"/metrics/drift failed: {drift_res.text}"
    drift_data = drift_res.json()
    assert "status" in drift_data
    print(f" [7/8] GET /metrics/drift succeeded! Drift status: {drift_data['status']}")

    # 8. Prometheus Telemetry (GET /metrics)
    prom_res = client.get("/metrics")
    assert prom_res.status_code == 200, f"/metrics failed: {prom_res.text}"
    assert "netwatch_flows_scored" in prom_res.text
    print(f" [8/8] GET /metrics (Prometheus) succeeded! Length: {len(prom_res.text)} bytes")

    # 9. Test /models endpoint
    models_res = client.get("/models")
    assert models_res.status_code == 200, f"/models failed: {models_res.text}"
    models_data = models_res.json()
    assert "version_history" in models_data
    print(f" [Bonus] GET /models succeeded! Found {len(models_data.get('version_history', []))} versions")

    print("\nALL BACKEND INTEGRATION CHECKS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    run_integration_checks()
