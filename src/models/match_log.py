from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from src.database import Base

class MatchLog(Base):
    __tablename__ = "match_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    event_type = Column(String, nullable=False) # e.g. "draw", "rotate"
    created_at = Column(DateTime(timezone=True), nullable=False)

    session = relationship("Session", backref="match_logs")
