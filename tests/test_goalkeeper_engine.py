import pytest
from fastapi.testclient import TestClient
from src.database import Base, SessionLocal, engine
from src.models.session import Session
from src.models.player import Player
from src.engine.match import (
    draw_teams, rotate_players, pull_next_player, 
    pick_entering_quartet, pick_entering_goalkeeper
)
from src.engine.explainer import generate_teams_explanation, generate_queue_explanation
from src.services.player_service import parse_whatsapp_entries, import_whatsapp_presence_list, set_player_goalkeeper
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


def test_draw_teams_with_goalkeepers():
    """Initial draw with 2 goalkeepers and 8 field players: 1 GK + 4 field per team."""
    players = []
    # 2 GKs
    g1 = Player(id=1, session_id=1, name="Goleiro 1", is_goalkeeper=True, has_arrived=True)
    g2 = Player(id=2, session_id=1, name="Goleiro 2", is_goalkeeper=True, has_arrived=True)
    players.extend([g1, g2])
    # 8 Field players
    for i in range(8):
        players.append(Player(id=i+3, session_id=1, name=f"Linha {i+1}", is_goalkeeper=False, has_arrived=True))

    draw_teams(players)

    t1 = [p for p in players if p.is_playing and p.team_slot == 1]
    t2 = [p for p in players if p.is_playing and p.team_slot == 2]

    assert len(t1) == 5  # 1 GK + 4 Field
    assert len(t2) == 5

    t1_gks = [p for p in t1 if p.is_goalkeeper]
    t2_gks = [p for p in t2 if p.is_goalkeeper]
    assert len(t1_gks) == 1
    assert len(t2_gks) == 1

    t1_field = [p for p in t1 if not p.is_goalkeeper]
    t2_field = [p for p in t2 if not p.is_goalkeeper]
    assert len(t1_field) == 4
    assert len(t2_field) == 4


def test_draw_teams_with_extra_goalkeepers():
    """Initial draw with 3 goalkeepers: 1 in team 1, 1 in team 2, 1 in queue."""
    players = []
    for i in range(3):
        players.append(Player(id=i+1, session_id=1, name=f"Goleiro {i+1}", is_goalkeeper=True, has_arrived=True))
    for i in range(8):
        players.append(Player(id=i+4, session_id=1, name=f"Linha {i+1}", is_goalkeeper=False, has_arrived=True))

    draw_teams(players)

    waiting = [p for p in players if not p.is_playing]
    waiting_gks = [p for p in waiting if p.is_goalkeeper]
    assert len(waiting_gks) == 1
    assert waiting_gks[0].team_slot == 0


def test_draw_teams_without_goalkeepers():
    """When no goalkeepers are present, operates standard 4v4."""
    players = [
        Player(id=i+1, session_id=1, name=f"Linha {i+1}", is_goalkeeper=False, has_arrived=True)
        for i in range(8)
    ]
    draw_teams(players)

    t1 = [p for p in players if p.is_playing and p.team_slot == 1]
    t2 = [p for p in players if p.is_playing and p.team_slot == 2]
    assert len(t1) == 4
    assert len(t2) == 4


def test_rotate_goalkeepers_with_waiting_gk():
    """When Team 1 wins and there is a waiting GK, the losing GK rotates out."""
    gk1 = Player(id=1, session_id=1, name="GK 1", is_goalkeeper=True, is_playing=True, team_slot=1, cycles_in_court=1)
    gk2 = Player(id=2, session_id=1, name="GK 2", is_goalkeeper=True, is_playing=True, team_slot=2, cycles_in_court=1)
    gk3 = Player(id=3, session_id=1, name="GK 3", is_goalkeeper=True, is_playing=False, team_slot=0, cycles_waiting=2)

    field_players = []
    # Team 1: 4 field
    for i in range(4):
        field_players.append(Player(id=10+i, session_id=1, name=f"F1_{i}", is_playing=True, team_slot=1, cycles_in_court=1))
    # Team 2: 4 field
    for i in range(4):
        field_players.append(Player(id=20+i, session_id=1, name=f"F2_{i}", is_playing=True, team_slot=2, cycles_in_court=1))
    # Waiting field: 4 players
    for i in range(4):
        field_players.append(Player(id=30+i, session_id=1, name=f"Wait_{i}", is_playing=False, team_slot=0, cycles_waiting=1))

    all_players = [gk1, gk2, gk3] + field_players

    # Winner is Team 1
    entering = rotate_players(all_players, winner=1)

    # GK1 won: stays on Team 1, cycles_in_court increases
    assert gk1.is_playing is True
    assert gk1.team_slot == 1
    assert gk1.cycles_in_court == 2

    # GK2 lost: rotated out to waiting queue
    assert gk2.is_playing is False
    assert gk2.team_slot == 0
    assert gk2.cycles_waiting == 1

    # GK3 entered: now on Team 2
    assert gk3.is_playing is True
    assert gk3.team_slot == 2
    assert gk3.cycles_in_court == 1
    assert gk3 in entering


def test_rotate_goalkeepers_without_waiting_gk():
    """When only 2 GKs exist, both GKs stay in court even if a team loses."""
    gk1 = Player(id=1, session_id=1, name="GK 1", is_goalkeeper=True, is_playing=True, team_slot=1, cycles_in_court=1)
    gk2 = Player(id=2, session_id=1, name="GK 2", is_goalkeeper=True, is_playing=True, team_slot=2, cycles_in_court=1)

    field_players = []
    for i in range(4):
        field_players.append(Player(id=10+i, session_id=1, name=f"F1_{i}", is_playing=True, team_slot=1, cycles_in_court=1))
    for i in range(4):
        field_players.append(Player(id=20+i, session_id=1, name=f"F2_{i}", is_playing=True, team_slot=2, cycles_in_court=1))
    for i in range(4):
        field_players.append(Player(id=30+i, session_id=1, name=f"Wait_{i}", is_playing=False, team_slot=0, cycles_waiting=1))

    all_players = [gk1, gk2] + field_players

    # Winner is Team 1
    rotate_players(all_players, winner=1)

    # Both GKs must still be playing so neither team lacks a GK!
    assert gk1.is_playing is True
    assert gk1.team_slot == 1
    assert gk2.is_playing is True
    assert gk2.team_slot == 2


def test_pull_next_player_goalkeeper_vs_field():
    """pull_next_player respects is_goalkeeper parameter."""
    gk_waiting = Player(id=1, session_id=1, name="GK Wait", is_goalkeeper=True, is_playing=False, cycles_waiting=5)
    field_waiting = Player(id=2, session_id=1, name="Field Wait", is_goalkeeper=False, is_playing=False, cycles_waiting=10)
    
    # 4 playing on Team 1, 3 playing on Team 2 (one field player left)
    team1 = [Player(id=10+i, session_id=1, name=f"T1_{i}", is_playing=True, team_slot=1) for i in range(4)]
    team2 = [Player(id=20+i, session_id=1, name=f"T2_{i}", is_playing=True, team_slot=2) for i in range(3)]
    
    all_players = [gk_waiting, field_waiting] + team1 + team2

    # Pull next field player
    pulled_field = pull_next_player(all_players, is_goalkeeper=False)
    assert pulled_field == field_waiting
    assert pulled_field.is_playing is True
    assert pulled_field.team_slot == 2

    # Now test pulling a goalkeeper when Team 2 lacks a goalkeeper
    gk_waiting_2 = Player(id=3, session_id=1, name="GK Wait 2", is_goalkeeper=True, is_playing=False, cycles_waiting=3)
    field_waiting_2 = Player(id=4, session_id=1, name="Field Wait 2", is_goalkeeper=False, is_playing=False, cycles_waiting=8)
    all_players_2 = [gk_waiting_2, field_waiting_2] + team1 + team2
    pulled_gk = pull_next_player(all_players_2, is_goalkeeper=True)
    assert pulled_gk == gk_waiting_2
    assert pulled_gk.is_playing is True
    assert pulled_gk.team_slot == 2


def test_explainer_goalkeepers():
    """generate_teams_explanation displays GK with glove and separate GK queue."""
    gk1 = Player(id=1, session_id=1, name="Alisson", is_goalkeeper=True, is_playing=True, team_slot=1)
    gk2 = Player(id=2, session_id=1, name="Ederson", is_goalkeeper=True, is_playing=True, team_slot=2)
    gk3 = Player(id=3, session_id=1, name="Cássio", is_goalkeeper=True, is_playing=False)
    
    field = [
        Player(id=10+i, session_id=1, name=f"Jogador {i+1}", is_playing=True, team_slot=1 if i < 4 else 2)
        for i in range(8)
    ]
    waiting_field = [
        Player(id=20+i, session_id=1, name=f"Reserva {i+1}", is_playing=False)
        for i in range(4)
    ]

    all_players = [gk1, gk2, gk3] + field + waiting_field
    text = generate_teams_explanation(all_players)

    assert "🧤 *Goleiro:* Alisson" in text
    assert "🧤 *Goleiro:* Ederson" in text
    assert "🧤 *Fila de Goleiros:*" in text
    assert "Cássio" in text


def test_whatsapp_parser_goalkeeper():
    """parse_whatsapp_entries identifies goleiro indicators."""
    raw_text = """
    1 - Jhimy
    2 - Jefin (goleiro)
    3 - Marcão (gol)
    4 - Dida 🧤
    5 - Pedrinho (jovem)
    6 - Gabriel
    """
    entries = parse_whatsapp_entries(raw_text)
    assert len(entries) == 6
    
    gks = [e for e in entries if e["is_goalkeeper"]]
    assert len(gks) == 3
    gk_names = [e["name"] for e in gks]
    assert "Jefin" in gk_names
    assert "Marcão" in gk_names
    assert "Dida" in gk_names


def test_whatsapp_parser_copied_presence_list_format():
    """Verify parser understands the exact format produced by handleCopyPresenceList."""
    raw_text = """
    ⚽ *Lista de Presença - Pelada 08/09/2026*

    🧤 *Goleiros* (2)
    1 - Marcão (Pago)
    2 - Jefin 🧒 (Pendente)

    🟢 *Presença confirmada (Linha - Pagos)* (2)
    1 - Jhimy
    2 - Pedrinho 🧒

    ⏳ *Presença confirmada (Linha - Pendente)* (1)
    1 - Gabriel

    🏖️ *Pagos que não irão* (1)
    1 - Dida 🧤
    """
    entries = parse_whatsapp_entries(raw_text)
    assert len(entries) == 6
    gks = [e for e in entries if e["is_goalkeeper"]]
    assert len(gks) == 3
    gk_names = [e["name"] for e in gks]
    assert "Marcão" in gk_names
    assert "Jefin" in gk_names
    assert "Dida" in gk_names

    jovens = [e for e in entries if e["category"] == "jovem"]
    assert len(jovens) == 2
    jovem_names = [e["name"] for e in jovens]
    assert "Jefin" in jovem_names
    assert "Pedrinho" in jovem_names


def test_goalkeeper_api_workflow():
    """Test API endpoints for setting goalkeeper, adding player as goalkeeper, and match response."""
    db = SessionLocal()
    session = Session(chat_id=12345, is_active=True, public_hash="testhash", admin_token="testtoken")
    db.add(session)
    db.commit()
    db.refresh(session)

    # 1. Add goalkeeper via public hash
    resp = client.post(
        f"/sessions/hash/{session.public_hash}/adicionar?token={session.admin_token}",
        json={"name": "Courtois", "is_paying": True, "do_checkin": True, "is_goalkeeper": True}
    )
    assert resp.status_code == 200
    data = resp.json()
    p_courtois = next(p for p in data["all_players"] if p["name"] == "Courtois")
    assert p_courtois["is_goalkeeper"] is True

    # 2. Add regular player then toggle goalkeeper via endpoint
    resp2 = client.post(
        f"/sessions/hash/{session.public_hash}/adicionar?token={session.admin_token}",
        json={"name": "Neymar", "is_paying": True, "do_checkin": True, "is_goalkeeper": False}
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    p_neymar = next(p for p in data2["all_players"] if p["name"] == "Neymar")
    assert p_neymar["is_goalkeeper"] is False

    # Toggle Neymar to Goalkeeper
    resp_toggle = client.post(
        f"/sessions/hash/{session.public_hash}/goleiro?token={session.admin_token}",
        json={"player_id": p_neymar["id"], "is_goalkeeper": True}
    )
    assert resp_toggle.status_code == 200
    data_toggle = resp_toggle.json()
    p_neymar_updated = next(p for p in data_toggle["all_players"] if p["name"] == "Neymar")
    assert p_neymar_updated["is_goalkeeper"] is True

    # 3. Batch action test
    resp_batch = client.post(
        f"/sessions/hash/{session.public_hash}/batch-action?token={session.admin_token}",
        json={"player_ids": [p_neymar["id"]], "action": "unset_goalkeeper"}
    )
    assert resp_batch.status_code == 200
    data_batch = resp_batch.json()
    p_neymar_line = next(p for p in data_batch["all_players"] if p["name"] == "Neymar")
    assert p_neymar_line["is_goalkeeper"] is False

    # 4. Test GET /sessions/{session_id}/players includes is_goalkeeper
    # Set Courtois back to goalkeeper and check admin endpoint
    resp_admin_toggle = client.post(
        f"/sessions/{session.id}/players/{p_neymar['id']}/goleiro",
        json={"player_id": p_neymar["id"], "is_goalkeeper": True}
    )
    assert resp_admin_toggle.status_code == 200

    resp_players = client.get(f"/sessions/{session.id}/players")
    assert resp_players.status_code == 200
    players_data = resp_players.json()
    p_neymar_listed = next(p for p in players_data if p["id"] == p_neymar["id"])
    assert "is_goalkeeper" in p_neymar_listed
    assert p_neymar_listed["is_goalkeeper"] is True

    db.close()
