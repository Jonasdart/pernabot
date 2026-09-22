import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.database import Base, get_db
from src.api.main import app

@pytest.fixture
def test_client():
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
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_default_group_and_members_flow(test_client):
    # 1. Get default group
    res = test_client.get("/groups/default")
    assert res.status_code == 200
    data = res.json()
    assert "group" in data
    assert data["group"]["name"] == "Pelada Oficial"
    group_id = data["group"]["id"]

    # 2. Update group settings (frequency, fees, due day)
    update_res = test_client.put(f"/groups/{group_id}", json={
        "name": "Pelada dos Amigos da Terça",
        "frequency_type": "weekly",
        "frequency_config": '{"days": [1, 3]}', # Terça e Quinta
        "monthly_fee": 60.0,
        "per_match_fee": 20.0,
        "due_day": 5,
        "pix_key": "pelada@pix.com"
    })
    assert update_res.status_code == 200

    # 3. Create members (mensalista and avulso)
    m1_res = test_client.post(f"/groups/{group_id}/members", json={
        "name": "Carlos Mensalista",
        "member_type": "mensalista",
        "is_goalkeeper": False,
        "category": "default"
    })
    assert m1_res.status_code == 200
    m1_id = m1_res.json()["member_id"]

    m2_res = test_client.post(f"/groups/{group_id}/members", json={
        "name": "Roberto Avulso",
        "member_type": "avulso",
        "is_goalkeeper": True,
        "category": "default"
    })
    assert m2_res.status_code == 200
    m2_id = m2_res.json()["member_id"]

    # 4. List members
    members_res = test_client.get(f"/groups/{group_id}/members?year=2026&month=9")
    assert members_res.status_code == 200
    members = members_res.json()
    carlos = next(m for m in members if m["id"] == m1_id)
    assert carlos["member_type"] == "mensalista"
    assert carlos["payment_status"] == "pending"

    # 5. Toggle monthly payment for Carlos
    pay_res = test_client.post(f"/groups/{group_id}/payments/toggle", json={
        "member_id": m1_id,
        "year": 2026,
        "month": 9,
        "is_paid": True,
        "amount": 60.0
    })
    assert pay_res.status_code == 200
    assert pay_res.json()["status"] == "paid"

    # Verify payment status is now paid
    members_res_after = test_client.get(f"/groups/{group_id}/members?year=2026&month=9")
    carlos_after = next(m for m in members_res_after.json() if m["id"] == m1_id)
    assert carlos_after["payment_status"] == "paid"

    # 6. Open a new matchday for the group
    matchday_res = test_client.post(f"/groups/{group_id}/matchdays/new")
    assert matchday_res.status_code == 200
    new_sess_data = matchday_res.json()
    new_session_id = new_sess_data["session_id"]
    new_hash = new_sess_data["public_hash"]

    # 7. Add mensalistas to the matchday presence list
    add_res = test_client.post(f"/groups/{group_id}/matchdays/{new_session_id}/add-members", json={
        "all_mensalistas": True
    })
    assert add_res.status_code == 200
    assert add_res.json()["added_count"] >= 1

    # Check matchday players: Carlos should be present and is_paying=True automatically because September is paid!
    session_players = test_client.get(f"/sessions/{new_session_id}/players").json()
    carlos_player = next((p for p in session_players if p["name"] == "Carlos Mensalista"), None)
    assert carlos_player is not None
    assert carlos_player["is_confirmed"] == True
    assert carlos_player["is_paying"] == True


def test_group_security_blocks_unauthorized_access(test_client, monkeypatch):
    monkeypatch.setenv("ADMIN_KEY", "chave_mestra_123")

    # 1. Access without key -> 401
    res = test_client.get("/groups/default")
    assert res.status_code == 401
    assert "não autorizado" in res.json()["detail"]

    # 2. Access with wrong key -> 401
    res = test_client.get("/groups/default?key=errado")
    assert res.status_code == 401

    # 3. Access with court admin_token (cannot escalate to group management!) -> 401
    res = test_client.get("/groups/default?key=token_da_quadra")
    assert res.status_code == 401

    # 4. Access with correct master ADMIN_KEY -> 200
    res = test_client.get("/groups/default?key=chave_mestra_123")
    assert res.status_code == 200


def test_presence_list_pulls_payment_automatically_from_roster(test_client):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    curr_year = now.year
    curr_month = now.month

    # 1. Get default group
    res = test_client.get("/groups/default")
    assert res.status_code == 200
    group_id = res.json()["group"]["id"]

    # 2. Create members in the elenco
    m1_res = test_client.post(f"/groups/{group_id}/members", json={
        "name": "João Silva",
        "member_type": "mensalista",
        "is_goalkeeper": False,
        "category": "default"
    })
    m1_id = m1_res.json()["member_id"]

    m2_res = test_client.post(f"/groups/{group_id}/members", json={
        "name": "Marcos Rocha",
        "member_type": "mensalista",
        "is_goalkeeper": True,
        "category": "default"
    })
    m2_id = m2_res.json()["member_id"]

    m3_res = test_client.post(f"/groups/{group_id}/members", json={
        "name": "Pedro Pagante",
        "member_type": "mensalista",
        "is_goalkeeper": False,
        "category": "default"
    })
    m3_id = m3_res.json()["member_id"]

    # 3. Mark João Silva and Pedro Pagante as paid for current month
    pay_res = test_client.post(f"/groups/{group_id}/payments/toggle", json={
        "member_id": m1_id,
        "year": curr_year,
        "month": curr_month,
        "is_paid": True,
        "amount": 50.0
    })
    assert pay_res.status_code == 200

    pay_res2 = test_client.post(f"/groups/{group_id}/payments/toggle", json={
        "member_id": m3_id,
        "year": curr_year,
        "month": curr_month,
        "is_paid": True,
        "amount": 50.0
    })
    assert pay_res2.status_code == 200

    # 4. Open a matchday
    matchday_res = test_client.post(f"/groups/{group_id}/matchdays/new")
    assert matchday_res.status_code == 200
    session_id = matchday_res.json()["session_id"]

    # 5. Import WhatsApp presence list (Note: "Joao Silva" without accent)
    wpp_text = """
    1 - Joao Silva
    2 - Marcos Rocha
    3 - Visitante Avulso
    """
    import_res = test_client.post(f"/sessions/{session_id}/import-whatsapp", json={
        "text": wpp_text,
        "mark_paid": False
    })
    assert import_res.status_code == 200

    # 6. Verify presence list:
    # João Silva must be automatically is_paying = True (from base do elenco)
    # Marcos Rocha must be is_paying = False (mensalista pending)
    # Visitante must be is_paying = False
    players_res = test_client.get(f"/sessions/{session_id}/players").json()
    joao = next(p for p in players_res if p["name"] == "Joao Silva")
    marcos = next(p for p in players_res if p["name"] == "Marcos Rocha")
    visitante = next(p for p in players_res if p["name"] == "Visitante Avulso")

    assert joao["is_paying"] == True
    assert joao["member_id"] == m1_id
    assert marcos["is_paying"] == False
    assert marcos["member_id"] == m2_id
    assert marcos["is_goalkeeper"] == True # Inherited from member
    assert visitante["is_paying"] == False
    assert visitante["member_id"] is None

    # 7. Add Pedro Pagante manually to session without setting is_paying
    add_pedro_res = test_client.post(f"/sessions/{session_id}/players", json={
        "name": "Pedro Pagante",
        "is_paying": False,
        "is_confirmed": True
    })
    assert add_pedro_res.status_code == 200

    players_res2 = test_client.get(f"/sessions/{session_id}/players").json()
    pedro = next(p for p in players_res2 if p["name"] == "Pedro Pagante")
    assert pedro["is_paying"] == True # Automatically pulled from elenco
    assert pedro["member_id"] == m3_id

    # 8. Now mark Marcos Rocha as paid in elenco
    toggle_res = test_client.post(f"/groups/{group_id}/payments/toggle", json={
        "member_id": m2_id,
        "year": curr_year,
        "month": curr_month,
        "is_paid": True
    })
    assert toggle_res.status_code == 200

    # Presence list must immediately reflect that Marcos is now paid
    players_res3 = test_client.get(f"/sessions/{session_id}/players").json()
    marcos_updated = next(p for p in players_res3 if p["name"] == "Marcos Rocha")
    assert marcos_updated["is_paying"] == True

    # 9. Now cancel Marcos Rocha payment in elenco
    toggle_cancel = test_client.post(f"/groups/{group_id}/payments/toggle", json={
        "member_id": m2_id,
        "year": curr_year,
        "month": curr_month,
        "is_paid": False
    })
    assert toggle_cancel.status_code == 200

    players_res4 = test_client.get(f"/sessions/{session_id}/players").json()
    marcos_cancelled = next(p for p in players_res4 if p["name"] == "Marcos Rocha")
    assert marcos_cancelled["is_paying"] == False


def test_available_members_and_add_new_player_to_roster(test_client):
    # 1. Get default group
    res = test_client.get("/groups/default")
    group_id = res.json()["group"]["id"]

    # 2. Add members to elenco
    m1 = test_client.post(f"/groups/{group_id}/members", json={
        "name": "Membro Presente",
        "member_type": "mensalista",
        "is_goalkeeper": False
    }).json()["member_id"]

    m2 = test_client.post(f"/groups/{group_id}/members", json={
        "name": "Membro Ausente",
        "member_type": "mensalista",
        "is_goalkeeper": True
    }).json()["member_id"]

    # 3. Create matchday session
    session_id = test_client.post(f"/groups/{group_id}/matchdays/new").json()["session_id"]

    # 4. Add "Membro Presente" to the session
    test_client.post(f"/sessions/{session_id}/players", json={"name": "Membro Presente"})

    # 5. Check available-members: only "Membro Ausente" should be returned
    avail_res = test_client.get(f"/sessions/{session_id}/available-members")
    assert avail_res.status_code == 200
    avail_data = avail_res.json()
    avail_names = [m["name"] for m in avail_data]
    assert "Membro Ausente" in avail_names
    assert "Membro Presente" not in avail_names

    # 6. Add a brand new player with save_to_roster = True
    new_p_res = test_client.post(f"/sessions/{session_id}/players", json={
        "name": "Novato Direto No Elenco",
        "is_paying": True,
        "save_to_roster": True,
        "member_type": "mensalista",
        "is_goalkeeper": False
    })
    assert new_p_res.status_code == 200

    # 7. Check that "Novato Direto No Elenco" is now in the group's members table!
    roster_res = test_client.get(f"/groups/{group_id}/members")
    assert roster_res.status_code == 200
    roster_names = [m["name"] for m in roster_res.json()]
    assert "Novato Direto No Elenco" in roster_names



