"""Prometheus metrics, served by GET /metrics and scraped by
deployment/monitoring/prometheus.yml.

Counters and the latency histogram move as POST /score runs
(api/routes/score.py). Gauges are read at each scrape from the alert store, the
drift report and the served evaluation report (api/routes/metrics.py). All of it
lives in the API process, which runs one worker (deployment/docker/Dockerfile.api),
so the counters cover all of its traffic; a restart zeroes them, which
Prometheus' rate() and increase() allow for.
"""
from typing import Any, Dict

from prometheus_client import (CONTENT_TYPE_PLAIN_0_0_4, CollectorRegistry, Counter, Histogram,
                               ProcessCollector, disable_created_metrics, generate_latest)
from prometheus_client.core import GaugeMetricFamily

# the text format every Prometheus version reads (the library's newest, 1.0.0,
# is not)
CONTENT_TYPE = CONTENT_TYPE_PLAIN_0_0_4
# *_created timestamps for every counter: noise here
disable_created_metrics()

# a registry of our own, so tests and reloads never meet a duplicate
REGISTRY = CollectorRegistry()
ProcessCollector(registry=REGISTRY)   # CPU, memory, open files (Linux)

FLOWS_SCORED = Counter(
    "netwatch_flows_scored", "Flows received by POST /score", registry=REGISTRY)
FLOWS_ALERTED = Counter(
    "netwatch_flows_alerted",
    "Flows that raised an alert, new or folded into an open one; over flows scored, the alert rate",
    registry=REGISTRY)
ALERTS_OPENED = Counter(
    "netwatch_alerts_opened",
    "Alerts opened, by family (a burst of one family is one alert, api/routes/score.py)",
    ["family"], registry=REGISTRY)
SCORE_SECONDS = Histogram(
    "netwatch_score_request_seconds", "Time to score one POST /score request (a batch of flows)",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0), registry=REGISTRY)

DRIFT_STATUSES = ("warming_up", "stable", "warning", "drift")


def _gauge(name, doc, value, labels=None, label_values=None):
    g = GaugeMetricFamily(name, doc, labels=labels or [])
    g.add_metric(label_values or [], value)
    return g


class _Scrape:
    """The gauges for one scrape, from the state api/routes/metrics.py read."""

    def __init__(self, state: Dict[str, Any]):
        self.state = state

    def collect(self):
        s = self.state
        alerts = GaugeMetricFamily("netwatch_alerts", "Alerts in the store, by triage status",
                                   labels=["status"])
        for status, n in sorted(s["alerts"].items()):
            alerts.add_metric([status], n)
        yield alerts
        yield _gauge("netwatch_model_info", "The model version being served (models/ACTIVE); always 1",
                     1, ["version"], [s["model_version"]])

        report = s.get("report")
        if report:
            yield _gauge("netwatch_report_false_alerts_per_10k",
                         "False alerts per 10k benign test flows, classifier and detector together "
                         "(the evaluation report)", report["false_alerts_per_10k"])
            if report.get("budget_per_10k") is not None:
                yield _gauge("netwatch_report_false_alert_budget_per_10k",
                             "The false-alert budget, per 10k benign flows", report["budget_per_10k"])

        drift = s.get("drift")
        if drift:
            status = GaugeMetricFamily("netwatch_drift_status",
                                       "1 for the drift monitor's current status, 0 for the others",
                                       labels=["status"])
            for name in DRIFT_STATUSES:
                status.add_metric([name], 1 if drift.get("status") == name else 0)
            yield status
            top = drift.get("top_features") or []
            if top:
                yield _gauge("netwatch_drift_max_psi", "Largest feature PSI in the current window",
                             top[0]["psi"])
            for key, doc in (("unexplained_alert_rate", "Unknown-alert rate over the window, the drift rule's input"),
                             ("baseline_unexplained_alert_rate", "Its training baseline"),
                             ("flows_seen", "Benign-looking flows in the PSI window")):
                if drift.get(key) is not None:
                    yield _gauge(f"netwatch_drift_{key}", doc, drift[key])
            fp = (drift.get("fp_share") or {}).get("share")
            if fp is not None:
                yield _gauge("netwatch_analyst_false_positive_share",
                             "Share of recent alerts analysts marked false positive", fp)


def exposition(state: Dict[str, Any]) -> bytes:
    """The Prometheus text format: the counters, then this scrape's gauges."""
    scrape = CollectorRegistry(auto_describe=False)
    scrape.register(_Scrape(state))
    return generate_latest(REGISTRY) + generate_latest(scrape)
