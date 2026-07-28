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

def test_list_sessions(client_and_db, monkeypatch):
    client, session_id = client_and_db
    
    # Without ADMIN_KEY set in env, allows access
    response = client.get("/sessions")
    assert response.status_code == 200
    
    # With ADMIN_KEY set in env, blocks without valid key
    monkeypatch.setenv("ADMIN_KEY", "minha_senha_secreta")
    
    unauth_resp = client.get("/sessions")
    assert unauth_resp.status_code == 401
    
    wrong_key_resp = client.get("/sessions?key=errada")
    assert wrong_key_resp.status_code == 401
    
    auth_resp = client.get("/sessions?key=minha_senha_secreta")
    assert auth_resp.status_code == 200
    assert auth_resp.json()[0]["id"] == session_id

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

def test_checkin_checkout_payment_endpoints(client_and_db):
    client, session_id = client_and_db
    
    # 1. Add player without payment
    add_resp = client.post(f"/sessions/{session_id}/players", json={"name": "Novato", "is_paying": False, "is_confirmed": True})
    assert add_resp.status_code == 200
    p_id = add_resp.json()["player_id"]
    
    # 2. Try checkin without paying -> 400
    chk_resp = client.post(f"/sessions/{session_id}/players/{p_id}/checkin")
    assert chk_resp.status_code == 400
    assert "pagamento confirmado" in chk_resp.json()["detail"]
    
    # 3. Confirm payment
    pay_resp = client.post(f"/sessions/{session_id}/players/{p_id}/pagamento", json={"player_id": p_id, "is_paying": True})
    assert pay_resp.status_code == 200
    
    # 4. Do checkin -> success
    chk_success = client.post(f"/sessions/{session_id}/players/{p_id}/checkin")
    assert chk_success.status_code == 200
    
    # Verify arrived
    players = client.get(f"/sessions/{session_id}/players").json()
    p_data = next(p for p in players if p["id"] == p_id)
    assert p_data["has_arrived"] is True
    assert p_data["is_paying"] is True
    
    # 5. Do checkout -> success
    out_resp = client.post(f"/sessions/{session_id}/players/{p_id}/checkout")
    assert out_resp.status_code == 200
    
    players_after = client.get(f"/sessions/{session_id}/players").json()
    p_data_after = next(p for p in players_after if p["id"] == p_id)
    assert p_data_after["has_arrived"] is False

def test_liberar_endpoint(client_and_db):
    client, session_id = client_and_db
    
    # Add player without payment
    add_resp = client.post(f"/sessions/{session_id}/players", json={"name": "SemPagamento", "is_paying": False, "is_confirmed": True})
    assert add_resp.status_code == 200
    p_id = add_resp.json()["player_id"]
    
    # Checkin fails for unpaid player
    chk_resp = client.post(f"/sessions/{session_id}/players/{p_id}/checkin")
    assert chk_resp.status_code == 400
    
    # Liberar succeeds even without payment
    lib_resp = client.post(f"/sessions/{session_id}/players/{p_id}/liberar")
    assert lib_resp.status_code == 200
    
    players = client.get(f"/sessions/{session_id}/players").json()
    p_data = next(p for p in players if p["id"] == p_id)
    assert p_data["has_arrived"] is True
    assert p_data["is_paying"] is False

    # Test release via public hash
    sessions_resp = client.get("/sessions")
    s_data = sessions_resp.json()[0]
    public_hash = s_data["public_hash"]
    admin_token = s_data["admin_token"]

    add_resp_2 = client.post(f"/sessions/{session_id}/players", json={"name": "SemPagamento2", "is_paying": False, "is_confirmed": True})
    p_id_2 = add_resp_2.json()["player_id"]

    hash_lib_resp = client.post(f"/sessions/hash/{public_hash}/liberar?token={admin_token}", json={"player_id": p_id_2})
    assert hash_lib_resp.status_code == 200
    match_data = hash_lib_resp.json()
    p_data_2 = next(p for p in match_data["all_players"] if p["id"] == p_id_2)
    assert p_data_2["has_arrived"] is True
    assert p_data_2["is_paying"] is False

def test_recomecar_endpoints(client_and_db, monkeypatch):
    client, session_id = client_and_db
    monkeypatch.setenv("ADMIN_KEY", "minha_senha")

    # Mark Artilheiro as paying
    players = client.get(f"/sessions/{session_id}/players?key=minha_senha").json()
    artilheiro_id = next(p["id"] for p in players if p["name"] == "Artilheiro")
    client.post(f"/sessions/{session_id}/players/{artilheiro_id}/pagamento?key=minha_senha", json={"player_id": artilheiro_id, "is_paying": True})

    # Call restart via ID
    res = client.post(f"/sessions/{session_id}/recomecar?key=minha_senha")
    assert res.status_code == 200
    res_data = res.json()
    assert "new_session_id" in res_data
    new_session_id = res_data["new_session_id"]
    new_public_hash = res_data["public_hash"]
    new_admin_token = res_data["admin_token"]

    # Verify new session player list has only paying Artilheiro with stats 0
    new_players = client.get(f"/sessions/{new_session_id}/players?key=minha_senha").json()
    assert len(new_players) == 1
    assert new_players[0]["name"] == "Artilheiro"
    assert new_players[0]["is_paying"] is True
    assert new_players[0]["matches_played"] == 0

    # Call restart via hash with valid admin token
    res_hash = client.post(f"/sessions/hash/{new_public_hash}/recomecar?token={new_admin_token}")
    assert res_hash.status_code == 200
    match_data = res_hash.json()
    assert match_data["session_id"] != new_session_id
    assert match_data["is_admin"] is True

def test_public_hash_admin_authorization(client_and_db):
    client, session_id = client_and_db
    sessions_resp = client.get("/sessions")
    s_data = sessions_resp.json()[0]
    public_hash = s_data["public_hash"]
    admin_token = s_data["admin_token"]
    
    # Get player id
    match_resp = client.get(f"/sessions/hash/{public_hash}")
    p_id = match_resp.json()["all_players"][0]["id"]
    
    # 1. Unauthenticated / invalid token calls should return 403
    assert client.post(f"/sessions/hash/{public_hash}/checkin", json={"player_id": p_id}).status_code == 403
    assert client.post(f"/sessions/hash/{public_hash}/checkout", json={"player_id": p_id}).status_code == 403
    assert client.post(f"/sessions/hash/{public_hash}/pagamento", json={"player_id": p_id, "is_paying": True}).status_code == 403
    assert client.post(f"/sessions/hash/{public_hash}/adicionar", json={"name": "Outro"}).status_code == 403
    
    assert client.post(f"/sessions/hash/{public_hash}/checkin?token=wrong", json={"player_id": p_id}).status_code == 403
    
    # 2. Authenticated calls with valid admin_token should succeed
    pay_resp = client.post(f"/sessions/hash/{public_hash}/pagamento?token={admin_token}", json={"player_id": p_id, "is_paying": True})
    assert pay_resp.status_code == 200
    
    chk_resp = client.post(f"/sessions/hash/{public_hash}/checkin?token={admin_token}", json={"player_id": p_id})
    assert chk_resp.status_code == 200
    
    out_resp = client.post(f"/sessions/hash/{public_hash}/checkout?token={admin_token}", json={"player_id": p_id})
    assert out_resp.status_code == 200
    
    add_resp = client.post(f"/sessions/hash/{public_hash}/adicionar?token={admin_token}", json={"name": "Convidado"})
    assert add_resp.status_code == 200

def test_sortear_endpoint(client_and_db):
    client, session_id = client_and_db
    
    # < 8 players should return 400
    res_fail = client.post(f"/sessions/{session_id}/sortear")
    assert res_fail.status_code == 400
    assert "no mínimo 8 jogadores" in res_fail.json()["detail"]
    
    # Add enough players with arrival confirmed
    for i in range(6):
        add_res = client.post(f"/sessions/{session_id}/players", json={"name": f"Jogador_{i}", "is_paying": True, "do_checkin": True})
        assert add_res.status_code == 200
        
    # Now we have 8 arrived players, sortear should succeed
    res_ok = client.post(f"/sessions/{session_id}/sortear")
    assert res_ok.status_code == 200
    assert res_ok.json()["message"] == "Sorteio realizado com sucesso!"

def test_rotate_match_response(client_and_db):
    client, session_id = client_and_db
    sessions_resp = client.get("/sessions")
    s_data = sessions_resp.json()[0]
    public_hash = s_data["public_hash"]
    admin_token = s_data["admin_token"]
    
    # Add 8 players
    for i in range(8):
        client.post(f"/sessions/{session_id}/players", json={"name": f"P_{i}", "is_paying": True, "do_checkin": True})
        
    client.post(f"/sessions/hash/{public_hash}/sortear?token={admin_token}")
    
    # Perform match rotation (winner = 1)
    rotate_res = client.post(f"/sessions/hash/{public_hash}/vencer?token={admin_token}", json={"winner": 1})
    assert rotate_res.status_code == 200
    data = rotate_res.json()
    
    assert "last_result" in data
    assert data["last_result"]["winner"] == 1
    assert "winner_label" in data["last_result"]
    assert "entering_players" in data
    assert isinstance(data["entering_players"], list)
    assert data["last_event_type"] == "rotate"

def test_batch_player_actions(client_and_db):
    client, session_id = client_and_db
    sessions_resp = client.get("/sessions")
    s_data = sessions_resp.json()[0]
    public_hash = s_data["public_hash"]
    admin_token = s_data["admin_token"]

    # Add 3 unpaid/unarrived players
    p1 = client.post(f"/sessions/{session_id}/players", json={"name": "Batch_1", "is_paying": False, "is_confirmed": True}).json()["player_id"]
    p2 = client.post(f"/sessions/{session_id}/players", json={"name": "Batch_2", "is_paying": False, "is_confirmed": True}).json()["player_id"]
    p3 = client.post(f"/sessions/{session_id}/players", json={"name": "Batch_3", "is_paying": False, "is_confirmed": True}).json()["player_id"]

    # Test Batch Pay via Session ID endpoint
    pay_res = client.post(f"/sessions/{session_id}/players/batch-action", json={
        "player_ids": [p1, p2],
        "action": "pay"
    })
    assert pay_res.status_code == 200
    assert pay_res.json()["updated_count"] == 2

    # Verify payment status
    players_res = client.get(f"/sessions/{session_id}/players")
    p_map = {p["id"]: p for p in players_res.json()}
    assert p_map[p1]["is_paying"] is True
    assert p_map[p2]["is_paying"] is True
    assert p_map[p3]["is_paying"] is False

    # Test Batch Checkin via Public Hash endpoint
    checkin_res = client.post(f"/sessions/hash/{public_hash}/batch-action?token={admin_token}", json={
        "player_ids": [p1, p2, p3],
        "action": "checkin"
    })
    assert checkin_res.status_code == 200
    match_data = checkin_res.json()
    all_p_map = {p["id"]: p for p in match_data["all_players"]}
    assert all_p_map[p1]["has_arrived"] is True
    assert all_p_map[p2]["has_arrived"] is True
    assert all_p_map[p3]["has_arrived"] is True
    # Checkin auto-confirms payment for p3
    assert all_p_map[p3]["is_paying"] is True

    # Test Batch Checkout via Session ID endpoint
    checkout_res = client.post(f"/sessions/{session_id}/players/batch-action", json={
        "player_ids": [p1, p2],
        "action": "checkout"
    })
    assert checkout_res.status_code == 200
    players_res2 = client.get(f"/sessions/{session_id}/players")
    p_map2 = {p["id"]: p for p in players_res2.json()}
    assert p_map2[p1]["has_arrived"] is False
    assert p_map2[p2]["has_arrived"] is False
    assert p_map2[p3]["has_arrived"] is True






