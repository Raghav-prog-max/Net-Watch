import pytest
from datetime import datetime, timezone
from pydantic import ValidationError
from api.schemas import Alert, FlowData, Prediction, Severity, ExplanationItem, Mitre

@pytest.fixture
def valid_alert_data():
    return {
        "id": "alt_123",
        "timestamp": datetime.now(timezone.utc),
        "flow": {"dst_port": 80, "protocol": "TCP", "duration_ms": 12, "fwd_packets": 3, "bwd_packets": 0},
        "prediction": {"family": "DoS", "confidence": 0.94},
        "anomaly_score": 0.71,
        "is_novel": False,
        "severity": {"score": 86, "level": "Critical"},
        "explanation": [
            {"feature": "Flow Packets/s", "value": 48211.0, "impact": 0.32}
        ],
        "mitre": {"tactic": "Impact", "technique": "T1498 Network Denial of Service"},
        "recommended_action": "Investigate",
        "status": "open",
        "model_version": "v1"
    }

@pytest.mark.parametrize("missing_field", [
    "id", "timestamp", "flow", "prediction", "anomaly_score", 
    "is_novel", "severity", "explanation", "mitre", 
    "recommended_action", "model_version"
])
def test_alert_schema_missing_required(valid_alert_data, missing_field):
    del valid_alert_data[missing_field]
    with pytest.raises(ValidationError):
        Alert(**valid_alert_data)

@pytest.mark.parametrize("status,analyst_label,analyst_note", [
    ("open", None, None),
    ("escalated", "DoS", "Looks bad"),
    ("resolved", "Benign", ""),
    ("false_positive", "Unknown", "Custom note")
])
def test_alert_schema_optional_fields(valid_alert_data, status, analyst_label, analyst_note):
    valid_alert_data["status"] = status
    valid_alert_data["analyst_label"] = analyst_label
    valid_alert_data["analyst_note"] = analyst_note
    
    alert = Alert(**valid_alert_data)
    assert alert.status == status
    assert alert.analyst_label == analyst_label
    assert alert.analyst_note == analyst_note

@pytest.mark.parametrize("port", [-1, 0, 80, 65535, 999999])
def test_flow_data_ports(port):
    # In a real app we might validate port ranges (0-65535), 
    # but Pydantic just ensures int for now.
    flow = FlowData(dst_port=port, protocol="TCP", duration_ms=10, fwd_packets=5, bwd_packets=5)
    assert flow.dst_port == port

@pytest.mark.parametrize("field,invalid_value", [
    ("dst_port", "not-an-int"),
    ("duration_ms", "not-an-int"),
    ("fwd_packets", []),
    ("bwd_packets", {})
])
def test_flow_data_invalid_types(field, invalid_value):
    data = {"dst_port": 80, "protocol": "TCP", "duration_ms": 10, "fwd_packets": 5, "bwd_packets": 5}
    data[field] = invalid_value
    with pytest.raises(ValidationError):
        FlowData(**data)

@pytest.mark.parametrize("score,level", [
    (0, "Low"),
    (50, "Medium"),
    (100, "Critical"),
    (-10, "Unknown")
])
def test_severity_schema(score, level):
    sev = Severity(score=score, level=level)
    assert sev.score == score
    assert sev.level == level
