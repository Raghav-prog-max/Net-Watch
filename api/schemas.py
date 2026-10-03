from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, List, Literal, Optional, Any
from datetime import datetime

class FlowData(BaseModel):
    dst_port: int
    protocol: str
    duration_ms: int
    fwd_packets: int
    bwd_packets: int
    # Allow extra fields for arbitrary flow data during scoring
    model_config = ConfigDict(extra="allow")

class ScoredFlow(BaseModel):
    """One flow sent to POST /score: model features plus display-only metadata."""
    # CIC-IDS2017 column name -> value. A feature the model expects but the caller
    # leaves out is scored as 0.0, so send them all (replay/replayer.py does).
    features: Dict[str, float]
    # Shown to the analyst as the alert's `flow` (ports, IPs, ground truth in demos).
    # Never used for scoring.
    meta: Dict[str, Any] = Field(default_factory=dict)

class ScoreRequest(BaseModel):
    flows: List[ScoredFlow]

class RejectedLabel(BaseModel):
    family: str
    confidence: float

class Prediction(BaseModel):
    family: str
    confidence: float
    # Set when the classifier named a family but the flow looks nothing like it,
    # so the alert is shown as Unknown: what the classifier wanted to call it.
    rejected_label: Optional[RejectedLabel] = None
    # Named by the classifier and also abnormal to the anomaly detector: often a
    # variant of a known family.
    also_abnormal: Optional[bool] = None

class Severity(BaseModel):
    score: int
    level: str

class ExplanationItem(BaseModel):
    feature: str
    value: float
    impact: float

class Mitre(BaseModel):
    tactic: str
    technique: str

class AlertBase(BaseModel):
    timestamp: datetime
    # the request's `meta`, as strings (see ScoredFlow)
    flow: Dict[str, Any]
    prediction: Prediction
    anomaly_score: float
    is_novel: bool
    severity: Severity
    explanation: List[ExplanationItem]
    mitre: Mitre
    recommended_action: str
    status: str = "open"
    analyst_label: Optional[str] = None
    analyst_note: Optional[str] = None
    model_version: str
    flow_count: int = 1

class Alert(AlertBase):
    id: str

class ScoreResponse(BaseModel):
    scored: int
    # flows that raised an alert, new or folded into an open one: the alert rate.
    # `alerts` is shorter, as a burst of one family is one alert.
    alerted: int = 0
    # alerts opened by this request, and growing ones re-sent (at most every 5 s)
    alerts: List[Alert]

class AlertCreate(AlertBase):
    pass

# Handbook status flow: open -> acknowledged -> escalated or false_positive -> resolved.
# Any other value is refused (422); transitions are not enforced, an analyst may
# mark a false positive straight from open.
AlertStatus = Literal["open", "acknowledged", "escalated", "false_positive", "resolved"]


class Feedback(BaseModel):
    status: Optional[AlertStatus] = None
    analyst_label: Optional[str] = None
    analyst_note: Optional[str] = None
