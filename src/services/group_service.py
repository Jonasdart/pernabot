import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session as DbSession
from sqlalchemy import func
from src.models.group import Group
from src.models.member import Member
from src.models.monthly_payment import MonthlyPayment
from src.models.session import Session
from src.models.player import Player

def get_or_create_default_group(db: DbSession) -> Group:
    group = db.query(Group).first()
    if not group:
        group = Group(
            name="Pelada Oficial",
            frequency_type="weekly",
            frequency_config='{"days": [1]}', # Terça-feira padrão
            monthly_fee=50.0,
            per_match_fee=15.0,
            due_day=10
        )
        db.add(group)
        db.commit()
        db.refresh(group)
    return group

def get_group(db: DbSession, group_id: int) -> Optional[Group]:
    return db.query(Group).filter(Group.id == group_id).first()

def update_group(
    db: DbSession,
    group_id: int,
    name: Optional[str] = None,
    frequency_type: Optional[str] = None,
    frequency_config: Optional[str] = None,
    monthly_fee: Optional[float] = None,
    per_match_fee: Optional[float] = None,
    due_day: Optional[int] = None,
    pix_key: Optional[str] = None
) -> Optional[Group]:
    group = get_group(db, group_id)
    if not group:
        return None
    if name is not None:
        group.name = name.strip()
    if frequency_type is not None:
        group.frequency_type = frequency_type
    if frequency_config is not None:
        group.frequency_config = frequency_config
    if monthly_fee is not None:
        group.monthly_fee = float(monthly_fee)
    if per_match_fee is not None:
        group.per_match_fee = float(per_match_fee)
    if due_day is not None:
        group.due_day = int(due_day)
    if pix_key is not None:
        group.pix_key = pix_key.strip()

    db.add(group)
    db.commit()
    db.refresh(group)
    return group

def get_member_payment_status(db: DbSession, group_id: int, member_id: int, year: int, month: int) -> Dict[str, Any]:
    payment = db.query(MonthlyPayment).filter(
        MonthlyPayment.group_id == group_id,
        MonthlyPayment.member_id == member_id,
        MonthlyPayment.year == year,
        MonthlyPayment.month == month
    ).first()
    if payment and payment.status == "paid":
        return {
            "status": "paid",
            "amount": payment.amount,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            "payment_id": payment.id
        }
    return {
        "status": "pending",
        "amount": 0.0,
        "paid_at": None,
        "payment_id": None
    }

def list_members(
    db: DbSession,
    group_id: int,
    active_only: bool = True,
    year: Optional[int] = None,
    month: Optional[int] = None
) -> List[Dict[str, Any]]:
    query = db.query(Member).filter(Member.group_id == group_id)
    if active_only:
        query = query.filter(Member.is_active == True)
    members = query.order_by(Member.member_type.asc(), Member.name.asc()).all()

    now = datetime.now(timezone.utc)
    target_year = year or now.year
    target_month = month or now.month

    # Carregar pagamentos do mês para mapeamento rápido
    payments = db.query(MonthlyPayment).filter(
        MonthlyPayment.group_id == group_id,
        MonthlyPayment.year == target_year,
        MonthlyPayment.month == target_month
    ).all()
    pay_map = {p.member_id: p for p in payments}

    results = []
    for m in members:
        payment = pay_map.get(m.id)
        is_paid = payment is not None and payment.status == "paid"
        results.append({
            "id": m.id,
            "group_id": m.group_id,
            "name": m.name,
            "telegram_id": m.telegram_id,
            "telegram_username": m.telegram_username,
            "phone": m.phone,
            "member_type": m.member_type or "mensalista",
            "is_goalkeeper": bool(m.is_goalkeeper),
            "category": m.category or "default",
            "is_active": bool(m.is_active),
            "payment_status": "paid" if is_paid else "pending",
            "paid_amount": payment.amount if (payment and is_paid) else 0.0,
            "paid_at": payment.paid_at.isoformat() if (payment and payment.paid_at) else None,
            "target_year": target_year,
            "target_month": target_month
        })
    return results

def create_member(
    db: DbSession,
    group_id: int,
    name: str,
    member_type: str = "mensalista",
    is_goalkeeper: bool = False,
    category: str = "default",
    telegram_id: Optional[int] = None,
    telegram_username: Optional[str] = None,
    phone: Optional[str] = None
) -> Member:
    member = Member(
        group_id=group_id,
        name=name.strip().title(),
        member_type=member_type or "mensalista",
        is_goalkeeper=bool(is_goalkeeper),
        category=category or "default",
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        phone=phone,
        is_active=True
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

def update_member(
    db: DbSession,
    member_id: int,
    name: Optional[str] = None,
    member_type: Optional[str] = None,
    is_goalkeeper: Optional[bool] = None,
    category: Optional[str] = None,
    telegram_id: Optional[int] = None,
    telegram_username: Optional[str] = None,
    phone: Optional[str] = None,
    is_active: Optional[bool] = None
) -> Optional[Member]:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        return None
    if name is not None:
        member.name = name.strip().title()
    if member_type is not None:
        member.member_type = member_type
    if is_goalkeeper is not None:
        member.is_goalkeeper = bool(is_goalkeeper)
    if category is not None:
        member.category = category
    if telegram_id is not None:
        member.telegram_id = telegram_id
    if telegram_username is not None:
        member.telegram_username = telegram_username
    if phone is not None:
        member.phone = phone
    if is_active is not None:
        member.is_active = bool(is_active)

    db.add(member)
    db.commit()
    db.refresh(member)
    return member

def delete_member(db: DbSession, member_id: int) -> bool:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        return False
    # Soft delete
    member.is_active = False
    db.add(member)
    db.commit()
    return True

def toggle_monthly_payment(
    db: DbSession,
    group_id: int,
    member_id: int,
    year: int,
    month: int,
    is_paid: Optional[bool] = None,
    amount: Optional[float] = None
) -> Dict[str, Any]:
    group = get_group(db, group_id)
    payment = db.query(MonthlyPayment).filter(
        MonthlyPayment.group_id == group_id,
        MonthlyPayment.member_id == member_id,
        MonthlyPayment.year == year,
        MonthlyPayment.month == month
    ).first()

    default_fee = group.monthly_fee if group else 50.0

    if not payment:
        should_pay = True if is_paid is None else bool(is_paid)
        payment = MonthlyPayment(
            group_id=group_id,
            member_id=member_id,
            year=year,
            month=month,
            status="paid" if should_pay else "pending",
            amount=amount if (amount is not None) else default_fee,
            paid_at=datetime.now(timezone.utc) if should_pay else None
        )
        db.add(payment)
    else:
        if is_paid is None:
            new_status = "pending" if payment.status == "paid" else "paid"
        else:
            new_status = "paid" if is_paid else "pending"
        
        payment.status = new_status
        if amount is not None:
            payment.amount = float(amount)
        elif payment.amount <= 0:
            payment.amount = default_fee

        payment.paid_at = datetime.now(timezone.utc) if new_status == "paid" else None
        db.add(payment)

    db.commit()
    db.refresh(payment)

    # Se houver jogadores nesta sessão atual vinculados a este member, atualizar o is_paying correspondente
    # para sincronizar em tempo real com o dia de jogo atual
    member = db.query(Member).filter(Member.id == member_id).first()
    active_sessions = db.query(Session).filter(
        (Session.group_id == group_id) | (Session.group_id.is_(None)),
        Session.is_active == True
    ).all()
    for s in active_sessions:
        if not s.group_id:
            s.group_id = group_id
            db.add(s)
        players_query = db.query(Player).filter(Player.session_id == s.id)
        if member:
            players_query = players_query.filter(
                (Player.member_id == member_id) | (func.lower(func.trim(Player.name)) == member.name.strip().lower())
            )
        else:
            players_query = players_query.filter(Player.member_id == member_id)
        players = players_query.all()
        for p in players:
            p.member_id = member_id
            p.is_paying = (payment.status == "paid")
            db.add(p)
    db.commit()

    return {
        "member_id": member_id,
        "year": year,
        "month": month,
        "status": payment.status,
        "amount": payment.amount,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None
    }

def get_group_dashboard_summary(db: DbSession, group_id: int, year: Optional[int] = None, month: Optional[int] = None) -> Dict[str, Any]:
    group = get_group(db, group_id)
    if not group:
        return {}

    now = datetime.now(timezone.utc)
    target_year = year or now.year
    target_month = month or now.month

    members = db.query(Member).filter(Member.group_id == group_id, Member.is_active == True).all()
    mensalistas = [m for m in members if m.member_type == "mensalista"]
    avulsos = [m for m in members if m.member_type == "avulso"]

    payments = db.query(MonthlyPayment).filter(
        MonthlyPayment.group_id == group_id,
        MonthlyPayment.year == target_year,
        MonthlyPayment.month == target_month,
        MonthlyPayment.status == "paid"
    ).all()
    paid_member_ids = {p.member_id for p in payments}
    total_collected = sum(p.amount for p in payments)

    paid_mensalistas = [m for m in mensalistas if m.id in paid_member_ids]
    pending_mensalistas = [m for m in mensalistas if m.id not in paid_member_ids]

    active_session = db.query(Session).filter(
        Session.group_id == group_id,
        Session.is_active == True
    ).order_by(Session.created_at.desc()).first()

    total_sessions_count = db.query(Session).filter(Session.group_id == group_id).count()

    return {
        "group": {
            "id": group.id,
            "name": group.name,
            "frequency_type": group.frequency_type,
            "frequency_config": group.frequency_config,
            "monthly_fee": group.monthly_fee,
            "per_match_fee": group.per_match_fee,
            "due_day": group.due_day,
            "pix_key": group.pix_key
        },
        "year": target_year,
        "month": target_month,
        "total_members": len(members),
        "total_mensalistas": len(mensalistas),
        "total_avulsos": len(avulsos),
        "paid_mensalistas_count": len(paid_mensalistas),
        "pending_mensalistas_count": len(pending_mensalistas),
        "total_collected": total_collected,
        "expected_monthly": len(mensalistas) * group.monthly_fee,
        "active_session": {
            "id": active_session.id,
            "public_hash": active_session.public_hash,
            "admin_token": active_session.admin_token,
            "checkin_code": active_session.checkin_code,
            "created_at": active_session.created_at.isoformat() if active_session and active_session.created_at else None
        } if active_session else None,
        "total_sessions_count": total_sessions_count
    }


def import_whatsapp_roster_members(db: DbSession, group_id: int, text: str, default_member_type: str = "mensalista") -> List[Member]:
    from src.services.player_service import parse_whatsapp_entries
    entries = parse_whatsapp_entries(text)
    imported = []
    for entry in entries:
        name = entry["name"].strip().title()
        is_gk = entry["is_goalkeeper"]
        cat = entry["category"]
        
        # Check if already exists in group
        existing = db.query(Member).filter(
            Member.group_id == group_id,
            func.lower(func.trim(Member.name)) == name.lower()
        ).first()
        
        if not existing:
            member = Member(
                group_id=group_id,
                name=name,
                member_type=default_member_type or "mensalista",
                is_goalkeeper=is_gk,
                category=cat or "default",
                is_active=True
            )
            db.add(member)
            imported.append(member)
        else:
            if is_gk:
                existing.is_goalkeeper = True
            if cat and cat != "default":
                existing.category = cat
            existing.is_active = True
            db.add(existing)
            imported.append(existing)
            
    db.commit()
    return imported

