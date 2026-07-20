from sqlalchemy import Column, Integer, String, Boolean, DateTime
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

    players = relationship("Player", back_populates="session", cascade="all, delete-orphan")
