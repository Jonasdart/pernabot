from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from src.database import Base

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Pelada Oficial", nullable=False)
    chat_id = Column(Integer, index=True, nullable=True)
    
    # Frequência dos Jogos:
    # 'weekly' (dias da semana), 'monthly' (dia do mês), 'biweekly', 'on_demand'
    frequency_type = Column(String, default="weekly", nullable=False)
    # JSON string ex: '{"days": [1, 3]}' (Terça e Quinta), ou '{"day_of_month": 15}'
    frequency_config = Column(String, default='{"days": [1]}', nullable=False)
    
    # Parâmetros Financeiros:
    monthly_fee = Column(Float, default=50.0, nullable=False)
    per_match_fee = Column(Float, default=15.0, nullable=False)
    due_day = Column(Integer, default=10, nullable=False) # Dia do mês em que vence a mensalidade
    pix_key = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("Member", back_populates="group", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="group")
    monthly_payments = relationship("MonthlyPayment", back_populates="group", cascade="all, delete-orphan")
