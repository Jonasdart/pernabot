import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.database import Base, get_db
import src.models as models
from src.api.main import app
from src.utils.geo import calculate_haversine_distance

@pytest.fixture
def client_with_geo():
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

    db = TestingSessionLocal()
    # Create group with location (e.g., Avenida Paulista, SP: -23.5615, -46.6559)
    group = models.Group(
        name="Pelada da Paulista",
        chat_id=12345,
        location_latitude=-23.5615,
        location_longitude=-46.6559,
        location_radius=1.0,
        location_name="Quadra da Paulista"
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    # Create session linked to this group
    session = models.Session(chat_id=12345, group_id=group.id, is_active=True, public_hash="geo-hash", checkin_code="geo-chk-123")
    db.add(session)
    db.commit()
    db.refresh(session)

    # Add player
    player = models.Player(session_id=session.id, name="Neymar", is_paying=True, is_confirmed=True)
    db.add(player)
    db.commit()
    db.refresh(player)

    group_id = group.id
    session_id = session.id
    player_id = player.id

    db.close()

    yield client, group_id, session_id, player_id, "geo-chk-123"

    app.dependency_overrides.clear()


def test_haversine_distance():
    # Same point
    assert calculate_haversine_distance(-23.5615, -46.6559, -23.5615, -46.6559) == 0.0

    # Approx 400-600 meters away (0.004 degrees lat is ~444m)
    d = calculate_haversine_distance(-23.5615, -46.6559, -23.5655, -46.6559)
    assert 0.4 < d < 0.6

    # 10 km away
    d_far = calculate_haversine_distance(-23.5615, -46.6559, -23.6515, -46.6559)
    assert d_far > 9.0


def test_checkin_info_returns_location_requirement(client_with_geo):
    client, group_id, session_id, player_id, checkin_code = client_with_geo

    res = client.get(f"/checkin/{checkin_code}")
    assert res.status_code == 200
    data = res.json()
    assert data["location_required"] is True
    assert data["location_radius"] == 1.0
    assert data["location_name"] == "Quadra da Paulista"


def test_self_checkin_blocked_without_coordinates(client_with_geo):
    client, group_id, session_id, player_id, checkin_code = client_with_geo

    # Try check-in with no latitude/longitude
    res = client.post(f"/checkin/{checkin_code}", json={"player_id": player_id})
    assert res.status_code == 400
    assert "Localização obrigatória" in res.json()["detail"]


def test_self_checkin_blocked_when_too_far(client_with_geo):
    client, group_id, session_id, player_id, checkin_code = client_with_geo

    # Try check-in from 5km away (-23.61, -46.6559)
    res = client.post(f"/checkin/{checkin_code}", json={
        "player_id": player_id,
        "latitude": -23.61,
        "longitude": -46.6559
    })
    assert res.status_code == 400
    assert "Check-in não permitido" in res.json()["detail"]
    assert "raio de até 1.0 km" in res.json()["detail"]


def test_self_checkin_allowed_when_within_radius(client_with_geo):
    client, group_id, session_id, player_id, checkin_code = client_with_geo

    # Within 150 meters (-23.5625, -46.6559)
    res = client.post(f"/checkin/{checkin_code}", json={
        "player_id": player_id,
        "latitude": -23.5625,
        "longitude": -46.6559
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["player"]["has_arrived"] is True


def test_checkin_unrestricted_when_group_has_no_location(client_with_geo):
    client, group_id, session_id, player_id, checkin_code = client_with_geo

    # Clear location on group
    update_res = client.put(f"/groups/{group_id}", json={
        "clear_location": True
    })
    assert update_res.status_code == 200

    # Info should show location_required: false
    info_res = client.get(f"/checkin/{checkin_code}")
    assert info_res.status_code == 200
    assert info_res.json()["location_required"] is False

    # Checkin without coordinates succeeds now
    add_p = client.post(f"/sessions/{session_id}/players", json={"name": "Messi", "is_paying": True})
    messi_id = add_p.json()["player_id"]

    chk_res = client.post(f"/checkin/{checkin_code}", json={"player_id": messi_id})
    assert chk_res.status_code == 200
    assert chk_res.json()["player"]["has_arrived"] is True
