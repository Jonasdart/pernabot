import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.database import Base, get_db
from src.api.main import app
from src.models.session import Session as PeladaSession
from src.models.player import Player

@pytest.fixture
def client_and_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    
    db = TestingSessionLocal()
    session = PeladaSession(chat_id=999, is_active=True)
    db.add(session)
    db.commit()
    db.refresh(session)
    
    p1 = Player(session_id=session.id, name="Artilheiro", has_arrived=True, matches_played=5, wins=4, draws=1, losses=0)
    p2 = Player(session_id=session.id, name="Defensor", has_arrived=True, matches_played=3, wins=1, draws=1, losses=1)
    db.add_all([p1, p2])
    db.commit()
    
    client = TestClient(app)
    yield client, session.id
    
    app.dependency_overrides.clear()
    db.close()

def test_list_sessions(client_and_db):
    client, session_id = client_and_db
    response = client.get("/sessions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["id"] == session_id

def test_list_players_frag_stats(client_and_db):
    client, session_id = client_and_db
    response = client.get(f"/sessions/{session_id}/players")
    assert response.status_code == 200
    players = response.json()
    assert len(players) == 2
    
    # Sorted by matches_played DESC
    top_player = players[0]
    assert top_player["name"] == "Artilheiro"
    assert top_player["matches_played"] == 5
    assert top_player["wins"] == 4
    assert top_player["draws"] == 1
    assert top_player["losses"] == 0
    assert top_player["points"] == 13
    assert "is_confirmed" in top_player
    assert "has_arrived" in top_player
    assert "is_paying" in top_player
    assert "estimated_time_minutes" in top_player

def test_session_not_found(client_and_db):
    client, _ = client_and_db
    response = client.get("/sessions/999999/players")
    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found"

def test_get_match_by_hash(client_and_db):
    client, session_id = client_and_db
    sessions_resp = client.get("/sessions")
    public_hash = sessions_resp.json()[0]["public_hash"]
    
    match_resp = client.get(f"/sessions/hash/{public_hash}")
    assert match_resp.status_code == 200
    data = match_resp.json()
    assert data["public_hash"] == public_hash
    assert "last_event_time" in data
    assert data["last_event_time"] is not None
    assert "+" in data["last_event_time"] or "Z" in data["last_event_time"]

