from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from src.database import Base

class MonthlyPayment(Base):
    __tablename__ = "monthly_payments"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True) # 1 - 12
    status = Column(String, default="paid", nullable=False) # 'paid', 'pending', 'exempt'
    amount = Column(Float, default=0.0, nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String, nullable=True)

    group = relationship("Group", back_populates="monthly_payments")
    member = relationship("Member", back_populates="monthly_payments")
