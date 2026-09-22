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

