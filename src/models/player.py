from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from src.database import Base

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    telegram_id = Column(Integer, index=True, nullable=True)
    telegram_username = Column(String, nullable=True)
    name = Column(String, nullable=False)
    
    is_confirmed = Column(Boolean, default=False)
    has_arrived = Column(Boolean, default=False)
    is_playing = Column(Boolean, default=False)
    is_paying = Column(Boolean, default=False)
    
    matches_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    cycles_in_court = Column(Integer, default=0)
    cycles_waiting = Column(Integer, default=0)
    
    arrival_order = Column(Integer, default=0)
    draw_weight = Column(Float, default=0.0)
    initial_draw_order = Column(Integer, default=9999)
    team_slot = Column(Integer, default=0)

    session = relationship("Session", back_populates="players")
