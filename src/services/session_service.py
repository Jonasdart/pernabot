import uuid
from sqlalchemy.orm import Session as DbSession
from src.models.session import Session

def ensure_session_hashes(db: DbSession, session: Session):
    if not session:
        return None
    updated = False
    if not session.public_hash:
        session.public_hash = uuid.uuid4().hex[:8]
        updated = True
    if not session.admin_token:
        session.admin_token = uuid.uuid4().hex[8:24]
        updated = True
    if not session.checkin_code:
        # Check if another session for the same chat_id already has a checkin_code
        existing_with_code = db.query(Session).filter(
            Session.chat_id == session.chat_id,
            Session.checkin_code.isnot(None)
        ).first()
        if existing_with_code and existing_with_code.checkin_code:
            session.checkin_code = existing_with_code.checkin_code
        else:
            session.checkin_code = session.public_hash or uuid.uuid4().hex[:8]
        updated = True
        
    if updated:
        db.add(session)
        db.commit()
        db.refresh(session)
    return session

def get_active_session(db: DbSession, chat_id: int):
    session = db.query(Session).filter(Session.chat_id == chat_id, Session.is_active == True).first()
    if session:
        ensure_session_hashes(db, session)
    return session

def get_session_by_hash(db: DbSession, public_hash: str):
    session = db.query(Session).filter(Session.public_hash == public_hash).first()
    if session:
        ensure_session_hashes(db, session)
    return session

def get_active_session_by_checkin_code(db: DbSession, checkin_code: str):
    # Try finding active session by checkin_code
    session = db.query(Session).filter(
        Session.checkin_code == checkin_code,
        Session.is_active == True
    ).first()
    
    if not session:
        # Try finding active session by public_hash as fallback
        session = db.query(Session).filter(
            Session.public_hash == checkin_code,
            Session.is_active == True
        ).first()

    if not session:
        # If no active session found, get latest session with this checkin_code or public_hash
        session = db.query(Session).filter(
            (Session.checkin_code == checkin_code) | (Session.public_hash == checkin_code)
        ).order_by(Session.created_at.desc()).first()

    if session:
        ensure_session_hashes(db, session)
    return session

def create_session(db: DbSession, chat_id: int, group_id: int = None):
    from src.models.group import Group
    # Check if a checkin_code already exists for this chat_id
    existing_session = db.query(Session).filter(
        Session.chat_id == chat_id,
        Session.checkin_code.isnot(None)
    ).first()
    
    persistent_checkin_code = existing_session.checkin_code if existing_session else None

    # Deactivate current active session if exists
    current_session = get_active_session(db, chat_id)
    if current_session:
        current_session.is_active = False
        db.add(current_session)
        if not persistent_checkin_code and current_session.checkin_code:
            persistent_checkin_code = current_session.checkin_code
        if not group_id and current_session.group_id:
            group_id = current_session.group_id
        
    if not group_id:
        grp = db.query(Group).filter(Group.chat_id == chat_id).first()
        if not grp:
            grp = db.query(Group).first()
        group_id = grp.id if grp else None

    public_hash = uuid.uuid4().hex[:8]
    admin_token = uuid.uuid4().hex[8:24]
    checkin_code = persistent_checkin_code or public_hash
    
    new_session = Session(
        chat_id=chat_id, 
        group_id=group_id,
        is_active=True,
        public_hash=public_hash,
        admin_token=admin_token,
        checkin_code=checkin_code
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


def create_group_matchday(db: DbSession, group_id: int):
    """
    Inicia um novo Dia de Jogo oficial para a pelada (Grupo), desativando o anterior
    e gerando um novo link/sessão sem perder membros ou duplicar tabelas.
    """
    from src.models.group import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    chat_id = group.chat_id if (group and group.chat_id) else 0
    return create_session(db, chat_id=chat_id, group_id=group_id)


