import pytest
from unittest.mock import AsyncMock, MagicMock
from src.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models.session import Session as PeladaSession
from src.models.player import Player
from src.bot.handlers.presence import handle_text

@pytest.fixture
def db_session(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    monkeypatch.setattr("src.bot.handlers.presence.SessionLocal", TestingSessionLocal)
    
    db = TestingSessionLocal()
    session = PeladaSession(chat_id=123, is_active=True)
    db.add(session)
    db.commit()
    yield db
    db.close()

@pytest.mark.anyio
async def test_presence_release_variantes(db_session):
    # Setup mock update & context
    update = MagicMock()
    update.effective_chat.id = 123
    update.effective_user.first_name = "Admin"
    update.effective_user.id = 999
    update.effective_user.username = "admin"
    update.message.reply_text = AsyncMock()
    
    context = MagicMock()
    context.bot.username = "pernabot"

    # Test "@joao liberado"
    update.message.text = "@joao liberado"
    await handle_text(update, context)
    
    player = db_session.query(Player).filter(Player.session_id == 1, Player.name == "joao").first()
    assert player is not None
    assert player.has_arrived is True
    assert player.is_paying is False

    # Test "fulano e ciclano liberados"
    update.message.text = "fulano e ciclano liberados"
    await handle_text(update, context)
    
    fulano = db_session.query(Player).filter(Player.session_id == 1, Player.name == "fulano").first()
    ciclano = db_session.query(Player).filter(Player.session_id == 1, Player.name == "ciclano").first()
    assert fulano.has_arrived is True
    assert ciclano.has_arrived is True

    # Test "mario, luigi e yoshi liberados"
    update.message.text = "mario, luigi e yoshi liberados"
    await handle_text(update, context)

    mario = db_session.query(Player).filter(Player.session_id == 1, Player.name == "mario").first()
    luigi = db_session.query(Player).filter(Player.session_id == 1, Player.name == "luigi").first()
    yoshi = db_session.query(Player).filter(Player.session_id == 1, Player.name == "yoshi").first()
    assert mario.has_arrived is True
    assert luigi.has_arrived is True
    assert yoshi.has_arrived is True
