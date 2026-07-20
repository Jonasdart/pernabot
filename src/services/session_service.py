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

def create_session(db: DbSession, chat_id: int):
    # Deactivate current active session if exists
    current_session = get_active_session(db, chat_id)
    if current_session:
        current_session.is_active = False
        db.add(current_session)
        
    public_hash = uuid.uuid4().hex[:8]
    admin_token = uuid.uuid4().hex[8:24]
    
    new_session = Session(
        chat_id=chat_id, 
        is_active=True,
        public_hash=public_hash,
        admin_token=admin_token
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

