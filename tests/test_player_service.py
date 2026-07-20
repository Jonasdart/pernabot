import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.database import Base
from src.models.session import Session as PeladaSession
from src.models.player import Player
from src.services.player_service import (
    confirm_presence,
    cancel_presence,
    register_arrival,
    set_paying_status,
    get_all_active_players,
    get_paying_players
)

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionClass = sessionmaker(bind=engine)
    db = SessionClass()
    
    pelada = PeladaSession(chat_id=12345, is_active=True)
    db.add(pelada)
    db.commit()
    db.refresh(pelada)
    
    yield db, pelada.id
    db.close()

def test_confirm_and_cancel_presence(db_session):
    db, session_id = db_session
    
    player = confirm_presence(db, session_id, name="Carlos", telegram_id=101)
    assert player is not None
    assert player.name == "Carlos"
    assert player.is_confirmed is True
    
    cancelled = cancel_presence(db, session_id, telegram_id=101)
    assert cancelled is True
    
    player_after = db.query(Player).filter(Player.id == player.id).first() if 'Player' in globals() else None
    assert player.is_confirmed is False

def test_register_arrival(db_session):
    db, session_id = db_session
    
    p1, is_new1 = register_arrival(db, session_id, name="Jogador 1", telegram_id=201)
    assert is_new1 is True
    assert p1.has_arrived is True
    assert p1.arrival_order == 1
    
    p2, is_new2 = register_arrival(db, session_id, name="Jogador 2", telegram_id=202)
    assert is_new2 is True
    assert p2.has_arrived is True
    assert p2.arrival_order == 2
    
    active_players = get_all_active_players(db, session_id)
    assert len(active_players) == 2

def test_set_paying_status(db_session):
    db, session_id = db_session
    
    player = confirm_presence(db, session_id, name="Mario", telegram_id=301)
    updated = set_paying_status(db, session_id, name="Mario", is_paying=True, telegram_id=301)
    
    assert updated.is_paying is True
    paying_list = get_paying_players(db, session_id)
    assert len(paying_list) == 1
    assert paying_list[0].id == player.id
