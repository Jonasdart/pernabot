from sqlalchemy.orm import Session as DbSession
from src.models.session import Session

def get_active_session(db: DbSession, chat_id: int):
    return db.query(Session).filter(Session.chat_id == chat_id, Session.is_active == True).first()

def create_session(db: DbSession, chat_id: int):
    # Deactivate current active session if exists
    current_session = get_active_session(db, chat_id)
    if current_session:
        current_session.is_active = False
        db.add(current_session)
        
    new_session = Session(chat_id=chat_id, is_active=True)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session
