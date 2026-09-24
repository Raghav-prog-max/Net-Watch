from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from datetime import datetime

class FlowData(BaseModel):
    dst_port: int
    protocol: str
    duration_ms: int
    fwd_packets: int
    bwd_packets: int
    # Allow extra fields for arbitrary flow data during scoring
    model_config = ConfigDict(extra="allow")

class Prediction(BaseModel):
    family: str
    confidence: float

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
    flow: FlowData
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

class Alert(AlertBase):
    id: str

class AlertCreate(AlertBase):
    pass

class Feedback(BaseModel):
    status: Optional[str] = None
    analyst_label: Optional[str] = None
    analyst_note: Optional[str] = None
