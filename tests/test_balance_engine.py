import pytest
from src.database import Base, SessionLocal, engine
from src.models.session import Session
from src.models.player import Player
from src.engine.match import draw_teams, rotate_players, pull_next_player, pick_entering_quartet
from src.config import BALANCE_CATEGORY_KEY, BALANCE_MAX_PER_TEAM
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(Player).delete()
        db.query(Session).delete()
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(Player).delete()
        db.query(Session).delete()
        db.commit()
    finally:
        db.close()

def test_draw_teams_balance_distribution():
    """Test that initial draw distributes special players without exceeding max quota per team."""
    players = []
    # 2 special players (jovens) + 8 regular players (adultos) = 10 players
    for i in range(2):
        p = Player(id=i+1, session_id=1, name=f"Jovem {i+1}", category=BALANCE_CATEGORY_KEY, has_arrived=True)
        players.append(p)
    for i in range(8):
        p = Player(id=i+3, session_id=1, name=f"Adulto {i+1}", category="default", has_arrived=True)
        players.append(p)

    draw_teams(players)

    t1 = [p for p in players if p.is_playing and p.team_slot == 1]
    t2 = [p for p in players if p.is_playing and p.team_slot == 2]

    assert len(t1) == 4
    assert len(t2) == 4

    spec_t1 = sum(1 for p in t1 if p.is_special_category)
    spec_t2 = sum(1 for p in t2 if p.is_special_category)

    # Neither team should exceed BALANCE_MAX_PER_TEAM (1)
    assert spec_t1 <= BALANCE_MAX_PER_TEAM
    assert spec_t2 <= BALANCE_MAX_PER_TEAM
    # Since there are 2 special players and 2 teams on court, each team gets exactly 1
    assert spec_t1 == 1
    assert spec_t2 == 1

def test_rotate_players_quota_skips_and_preserves_order():
    """
    Test that when a team is entering from the queue, if the top 2 players are special,
    only 1 enters, and the 2nd is skipped without losing priority (cycles_waiting increases).
    """
    # Active players: Team 1 has 4 players (1 special, 3 adults). Team 2 has 4 players (0 special, 4 adults).
    # Waiting: 2 special players + 4 adults
    playing = []
    # Team 1
    playing.append(Player(id=1, session_id=1, name="T1 Jovem", category=BALANCE_CATEGORY_KEY, is_playing=True, team_slot=1, cycles_in_court=1))
    for i in range(3):
        playing.append(Player(id=2+i, session_id=1, name=f"T1 Adulto {i+1}", category="default", is_playing=True, team_slot=1, cycles_in_court=1))

    # Team 2 (Loser)
    for i in range(4):
        playing.append(Player(id=5+i, session_id=1, name=f"T2 Adulto {i+1}", category="default", is_playing=True, team_slot=2, cycles_in_court=1))

    waiting = []
    # Jovem 1 and Jovem 2 both waiting 3 cycles
    j1 = Player(id=10, session_id=1, name="Jovem Fila 1", category=BALANCE_CATEGORY_KEY, is_playing=False, cycles_waiting=3, initial_draw_order=10)
    j2 = Player(id=11, session_id=1, name="Jovem Fila 2", category=BALANCE_CATEGORY_KEY, is_playing=False, cycles_waiting=3, initial_draw_order=11)
    waiting.extend([j1, j2])

    for i in range(4):
        waiting.append(Player(id=12+i, session_id=1, name=f"Adulto Fila {i+1}", category="default", is_playing=False, cycles_waiting=2, initial_draw_order=12+i))

    all_players = playing + waiting

    # Team 1 wins, Team 2 leaves
    entering = rotate_players(all_players, winner=1)

    assert len(entering) == 4

    # J1 should enter (1st in queue)
    assert j1 in entering
    assert j1.is_playing is True
    assert j1.team_slot == 2

    # J2 should be skipped because Team 2 already received J1 (max 1 special per team)
    assert j2 not in entering
    assert j2.is_playing is False
    # J2's waiting cycles should increase!
    assert j2.cycles_waiting == 4

    # Check that entering team has at most 1 special player
    spec_entering = sum(1 for p in entering if p.is_special_category)
    assert spec_entering == 1

def test_pull_next_player_respects_quota():
    """Test pull_next_player does not put a special player in a team that already has one."""
    playing = []
    # Team 1 has 3 players (1 special, 2 adults). Needs 1 player!
    playing.append(Player(id=1, session_id=1, name="T1 Jovem", category=BALANCE_CATEGORY_KEY, is_playing=True, team_slot=1, cycles_in_court=1))
    playing.append(Player(id=2, session_id=1, name="T1 Adulto 1", category="default", is_playing=True, team_slot=1, cycles_in_court=1))
    playing.append(Player(id=3, session_id=1, name="T1 Adulto 2", category="default", is_playing=True, team_slot=1, cycles_in_court=1))

    # Team 2 has 4 players
    for i in range(4):
        playing.append(Player(id=4+i, session_id=1, name=f"T2 Adulto {i+1}", category="default", is_playing=True, team_slot=2, cycles_in_court=1))

    # Waiting has a special player first, then an adult
    j = Player(id=10, session_id=1, name="Jovem Fila", category=BALANCE_CATEGORY_KEY, is_playing=False, cycles_waiting=5, initial_draw_order=10)
    a = Player(id=11, session_id=1, name="Adulto Fila", category="default", is_playing=False, cycles_waiting=4, initial_draw_order=11)

    all_players = playing + [j, a]

    pulled = pull_next_player(all_players)

    # Team 1 already has a special player, so the adult should be pulled instead of Jovem!
    assert pulled.id == a.id
    assert pulled.team_slot == 1
    assert j.is_playing is False

def test_api_category_toggle_and_config():
    """Test API endpoint to toggle player category and ensure balance_config is in match response."""
    db = SessionLocal()
    session = Session(chat_id=12345, public_hash="test-balance-hash", admin_token="test-admin-token")
    db.add(session)
    db.commit()
    db.refresh(session)

    p1 = Player(session_id=session.id, name="Jogador 1", category="default", is_confirmed=True)
    db.add(p1)
    db.commit()
    db.refresh(p1)
    pub_hash = session.public_hash
    adm_token = session.admin_token
    p1_id = p1.id
    db.close()

    # 1. Check match response contains balance_config
    res = client.get(f"/sessions/hash/{pub_hash}")
    assert res.status_code == 200
    data = res.json()
    assert "balance_config" in data
    assert data["balance_config"]["enabled"] is True
    assert data["balance_config"]["label"] == "Jovens"
    assert data["balance_config"]["emoji"] == "🧒"

    # 2. Toggle category via API
    res_cat = client.post(
        f"/sessions/hash/{pub_hash}/categoria?token={adm_token}",
        json={"player_id": p1_id, "is_special": True}
    )
    assert res_cat.status_code == 200
    cat_data = res_cat.json()
    player_in_res = next(p for p in cat_data["all_players"] if p["id"] == p1_id)
    assert player_in_res["is_special_category"] is True
    assert player_in_res["category"] == BALANCE_CATEGORY_KEY
