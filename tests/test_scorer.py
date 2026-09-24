import pytest
from api.services.scorer import severity_logic, score_flow
from api.services.mitre import get_mitre_dict
from api.schemas import FlowData

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

@pytest.mark.parametrize("dst_port,expected_family", [
    (80, "DoS"),
    (22, "BruteForce"),
    (443, "Benign"),
    (8080, "Benign")
])
def test_score_flow_mock_logic(dst_port, expected_family):
    flow = FlowData(dst_port=dst_port, protocol="TCP", duration_ms=10, fwd_packets=5, bwd_packets=5)
    alert = score_flow(flow)
    
    if expected_family == "Benign" and dst_port in [443, 8080]:
        # Mock logic ignores benign if anomaly_score < 0.5
        assert alert is None
    else:
        assert alert is not None
        assert alert["prediction"]["family"] == expected_family
