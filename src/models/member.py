from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, validates
from src.database import Base

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    
    name = Column(String, nullable=False, index=True)

    @validates("name")
    def validate_name(self, key, value):
        if value is not None:
            return value.strip().title()
        return value
    telegram_id = Column(Integer, index=True, nullable=True)
    telegram_username = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # 'mensalista' ou 'avulso'
    member_type = Column(String, default="mensalista", index=True, nullable=False)
    is_goalkeeper = Column(Boolean, default=False, index=True)
    category = Column(String, default="default", index=True)
    is_active = Column(Boolean, default=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("Group", back_populates="members")
    monthly_payments = relationship("MonthlyPayment", back_populates="member", cascade="all, delete-orphan")
    session_players = relationship("Player", back_populates="member")
