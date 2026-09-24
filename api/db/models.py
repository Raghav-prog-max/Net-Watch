from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON
from .session import Base

class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True)
    flow = Column(JSON)
    prediction = Column(JSON)
    anomaly_score = Column(Float)
    is_novel = Column(Boolean)
    severity = Column(JSON)
    explanation = Column(JSON)
    mitre = Column(JSON)
    recommended_action = Column(String)
    status = Column(String, default="open", index=True)
    analyst_label = Column(String, nullable=True)
    analyst_note = Column(String, nullable=True)
    model_version = Column(String)
