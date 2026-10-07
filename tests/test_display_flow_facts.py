"""The alert shows the flow facts the data carries, and nothing made up.

The notification drawer showed 192.168.1.x, port 443 and TCP for every alert:
the cleaner dropped the IPs, so no alert had them. CICIDS2017 has them; they
now stay in the data for display only, never as model features.

Run: pytest tests/test_display_flow_facts.py
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.services.scorer import flow_facts
from ml.data.clean import clean
from ml.features.select import feature_columns
from replay.replayer import build_batch


def _raw():
    # CICIDS2017 names the IP columns either way; rows 0 and 1 differ only in IPs
    return pd.DataFrame({
        "Flow ID": ["a", "b", "c"], "Src IP": ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
        "Dst IP": ["10.0.1.1", "10.0.1.1", "10.0.1.2"], "Source Port": [1, 2, 3],
        "Flow Duration": [10.0, 10.0, 30.0], "Destination Port": [80.0, 80.0, 22.0],
        "Total Fwd Packets": [3.0, 3.0, 9.0], "Label": ["BENIGN", "BENIGN", "DDoS"],
    })


def test_ips_stay_for_display_and_never_become_features():
    df = clean(_raw())
    assert {"Source IP", "Destination IP"} <= set(df.columns)
    assert not {"Flow ID", "Source Port", "Src IP", "Dst IP"} & set(df.columns)
    assert not {"Source IP", "Destination IP"} & set(feature_columns(df))


def test_flows_that_differ_only_in_ips_are_still_one_row_to_the_model():
    # dedup on the model columns: keeping IPs must not change the training data
    assert len(clean(_raw())) == 2


def test_replayer_sends_ips_as_meta_and_never_the_family():
    rows = clean(_raw()).assign(family=["Benign", "DDoS"])
    batch = build_batch(rows, ["Flow Duration"])
    assert batch[0]["meta"] == {"src_ip": "10.0.0.1", "dst_ip": "10.0.1.1"}
    assert all("family" not in item.get("meta", {}) for item in batch)


def test_without_ips_in_the_data_nothing_is_invented():
    rows = pd.DataFrame({"Flow Duration": [10.0], "Destination Port": [443.0]})
    item = build_batch(rows, ["Flow Duration", "Destination Port"])[0]
    assert "meta" not in item
    facts = flow_facts(item["features"], item.get("meta", {}))
    assert facts["dst_port"] == 443
    assert not {"src_ip", "dst_ip", "protocol"} & set(facts)


def test_alert_flow_carries_the_ips_it_was_sent():
    facts = flow_facts({"Destination Port": 80.0, "Protocol": 6.0},
                       {"src_ip": "10.0.0.1", "dst_ip": "10.0.1.1"})
    assert facts == {"dst_port": 80, "protocol": "TCP", "src_ip": "10.0.0.1", "dst_ip": "10.0.1.1"}
