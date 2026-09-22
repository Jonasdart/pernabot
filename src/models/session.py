from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from src.database import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    public_hash = Column(String, unique=True, index=True, nullable=True)
    admin_token = Column(String, unique=True, index=True, nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True, index=True)
    checkin_code = Column(String, index=True, nullable=True)

    group = relationship("Group", back_populates="sessions")
    players = relationship("Player", back_populates="session", cascade="all, delete-orphan")
