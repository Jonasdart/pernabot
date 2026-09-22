import pytest
from src.models.player import Player
from src.engine.match import draw_teams, rotate_players, pull_next_player

def create_mock_players(count: int):
    players = []
    for i in range(1, count + 1):
        p = Player(
            id=i,
            session_id=1,
            name=f"Player {i}",
            has_arrived=True,
            is_playing=False,
            matches_played=0,
            wins=0,
            draws=0,
            losses=0,
            arrival_order=i
        )
        players.append(p)
    return players

def test_draw_teams():
    players = create_mock_players(10)
    draw_teams(players)
    
    playing = [p for p in players if p.is_playing]
    waiting = [p for p in players if not p.is_playing]
    
    assert len(playing) == 8
    assert len(waiting) == 2
    
    team_1 = [p for p in playing if p.team_slot == 1]
    team_2 = [p for p in playing if p.team_slot == 2]
    
    assert len(team_1) == 4
    assert len(team_2) == 4

def test_rotate_players_team1_wins():
    players = create_mock_players(10)
    draw_teams(players)
    
    team_1 = [p for p in players if p.is_playing and p.team_slot == 1]
    team_2 = [p for p in players if p.is_playing and p.team_slot == 2]
    
    # Team 1 wins
    entering = rotate_players(players, winner=1)
    
    # Team 1 players should have 1 win and 1 match played
    for p in team_1:
        assert p.wins == 1
        assert p.losses == 0
        assert p.matches_played == 1
        
    # Team 2 players should have 1 loss and 1 match played
    for p in team_2:
        assert p.losses == 1
        assert p.wins == 0
        assert p.matches_played == 1

def test_rotate_players_draw():
    players = create_mock_players(8)
    draw_teams(players)
    
    rotate_players(players, winner=0)
    
    for p in players:
        assert p.draws == 1
        assert p.wins == 0
        assert p.losses == 0
        assert p.matches_played == 1

def test_pull_next_player():
    players = create_mock_players(9)
    draw_teams(players)
    
    # 8 playing, 1 waiting
    waiting_before = [p for p in players if not p.is_playing]
    assert len(waiting_before) == 1
    
    # Player in court leaves midway
    playing_before = [p for p in players if p.is_playing]
    leaving_player = playing_before[0]
    leaving_player.is_playing = False
    
    pulled = pull_next_player(players)
    assert pulled is not None
    assert pulled.id == waiting_before[0].id
    assert pulled.is_playing is True

from src.engine.match import sort_entering_players

def test_late_arrival_behind_waiting_players_with_zero_matches():
    """
    After draw, players 9..12 are waiting (matches_played=0).
    A late arrival player 13 arrives (matches_played=0).
    Player 13 should NOT jump ahead of waiting players 9..12.
    """
    players = create_mock_players(12)
    draw_teams(players)
    
    # Simulate late arrival after draw
    late_player = Player(
        id=13,
        session_id=1,
        name="Player 13 (Late)",
        has_arrived=True,
        is_playing=False,
        matches_played=0,
        cycles_waiting=1,
        arrival_order=13,
        initial_draw_order=9999
    )
    players.append(late_player)
    
    waiting = [p for p in players if not p.is_playing]
    sorted_waiting = sort_entering_players(waiting)
    
    # The late arrival should be at the end of the 0-match waiting players
    assert sorted_waiting[-1].id == 13

def test_late_arrival_ahead_of_waiting_players_with_matches_played():
    """
    If players in queue have already played a match (matches_played > 0),
    a late arrival (matches_played = 0) SHOULD have priority over them.
    """
    # 4 players who have played 1 match and are waiting
    p_played = []
    for i in range(1, 5):
        p_played.append(Player(
            id=i, session_id=1, name=f"Played {i}", has_arrived=True,
            is_playing=False, matches_played=1, cycles_waiting=1, arrival_order=i, initial_draw_order=i
        ))
        
    # Late arrival who hasn't played any match yet
    late_player = Player(
        id=5, session_id=1, name="Late 5", has_arrived=True,
        is_playing=False, matches_played=0, cycles_waiting=1, arrival_order=5, initial_draw_order=9999
    )
    
    waiting = p_played + [late_player]
    sorted_waiting = sort_entering_players(waiting)
    
    # Late player with 0 matches played should be first in queue
    assert sorted_waiting[0].id == 5

def test_draw_does_not_inflate_matches_played():
    """
    Ensure that when a draw occurs with 8+ waiting players, matches_played
    remains strictly equal to wins + draws + losses for each player.
    """
    players = create_mock_players(16)
    draw_teams(players)
    
    playing = [p for p in players if p.is_playing]
    p1 = playing[0]
    p2 = playing[1]
    p1.matches_played = 2
    p1.wins = 2
    p2.matches_played = 0
    p2.wins = 0
    
    # Rotate with draw (winner=0), with 8 players waiting
    rotate_players(players, winner=0)
    
    # p1 should now have 2 wins + 1 draw = 3 matches played (NOT equalized to max)
    assert p1.draws == 1
    assert p1.wins == 2
    assert p1.wins + p1.draws + p1.losses == 3
    
    # p2 should have 0 wins + 1 draw = 1 match played
    assert p2.draws == 1
    assert p2.wins == 0
    assert p2.wins + p2.draws + p2.losses == 1

def test_draw_with_four_teams_rotation_and_quartet_integrity():
    """
    Test scenario: 4 teams total (16 players).
    Team 1 and Team 2 draw.
    Team 3 and Team 4 (8 waiting players) enter the court.
    Team 1 and Team 2 leave and must remain as unmixed intact quartets in the queue.
    """
    players = create_mock_players(16)
    
    # Set up 4 distinct teams of 4 players each
    # Team 1 (court slot 1)
    team1_ids = {1, 2, 3, 4}
    for p in players[0:4]:
        p.is_playing = True
        p.team_slot = 1
        p.cycles_in_court = 1
        p.initial_draw_order = p.id
        
    # Team 2 (court slot 2)
    team2_ids = {5, 6, 7, 8}
    for p in players[4:8]:
        p.is_playing = True
        p.team_slot = 2
        p.cycles_in_court = 1
        p.initial_draw_order = p.id
        
    # Team 3 (queue, waiting)
    team3_ids = {9, 10, 11, 12}
    for p in players[8:12]:
        p.is_playing = False
        p.cycles_waiting = 2
        p.initial_draw_order = p.id
        
    # Team 4 (queue, waiting)
    team4_ids = {13, 14, 15, 16}
    for p in players[12:16]:
        p.is_playing = False
        p.cycles_waiting = 2
        p.initial_draw_order = p.id

    # Execute draw rotation
    entering = rotate_players(players, winner=0)
    
    # 1. Verify 8 players entered the court (Team 3 and Team 4)
    entering_ids = {p.id for p in entering}
    assert len(entering_ids) == 8
    assert entering_ids == team3_ids.union(team4_ids)
    
    # 2. Verify that Team 1 and Team 2 are now in queue
    waiting_after = [p for p in players if not p.is_playing]
    sorted_waiting_after = sort_entering_players(waiting_after)
    
    waiting_ids = [p.id for p in sorted_waiting_after]
    first_quartet_in_queue = set(waiting_ids[:4])
    second_quartet_in_queue = set(waiting_ids[4:8])
    
    # Either (first=Team1 and second=Team2) or (first=Team2 and second=Team1)
    # Crucially, neither quartet should mix players from Team 1 and Team 2!
    assert (first_quartet_in_queue == team1_ids and second_quartet_in_queue == team2_ids) or \
           (first_quartet_in_queue == team2_ids and second_quartet_in_queue == team1_ids)


def test_draw_teams_liberado_loses_priority_to_paying():
    """
    Ensures players marked as 'liberado' (is_paying=False) lose priority
    to paying players (is_paying=True) even if the liberado arrived earlier.
    """
    players = []
    # 2 Liberados who arrived early (#1 and #2)
    for i in range(1, 3):
        players.append(Player(
            id=i,
            session_id=1,
            name=f"Liberado Cedo {i}",
            is_confirmed=True,
            has_arrived=True,
            is_paying=False,
            arrival_order=i
        ))

    # 8 Pagantes who arrived later (#3 to #10)
    for i in range(3, 11):
        players.append(Player(
            id=i,
            session_id=1,
            name=f"Pagante Tarde {i}",
            is_confirmed=True,
            has_arrived=True,
            is_paying=True,
            arrival_order=i
        ))

    draw_teams(players)

    playing = [p for p in players if p.is_playing]
    waiting = [p for p in players if not p.is_playing]

    assert len(playing) == 8
    assert len(waiting) == 2

    # All 8 playing players MUST be pagantes
    for p in playing:
        assert p.is_paying is True, f"Player {p.name} should be playing because they paid"

    # Both waiting players MUST be the liberados who lost priority
    for p in waiting:
        assert p.is_paying is False, f"Player {p.name} should be in queue because they are liberado"


def test_draw_teams_arrival_order_priority_among_paying():
    """
    Ensures that among paying players, those who arrived earlier take priority for the court.
    """
    players = []
    # 10 Pagantes with arrival_order 1 to 10
    for i in range(1, 11):
        players.append(Player(
            id=i,
            session_id=1,
            name=f"Pagante {i}",
            is_confirmed=True,
            has_arrived=True,
            is_paying=True,
            arrival_order=i
        ))

    draw_teams(players)

    playing = [p for p in players if p.is_playing]
    waiting = [p for p in players if not p.is_playing]

    playing_orders = {p.arrival_order for p in playing}
    waiting_orders = {p.arrival_order for p in waiting}

    assert playing_orders == {1, 2, 3, 4, 5, 6, 7, 8}
    assert waiting_orders == {9, 10}


def test_draw_teams_presence_list_tiebreaker():
    """
    Ensures that when arrival_order is tied (e.g. batch checkin),
    the presence list order (id) breaks the tie.
    """
    players = []
    # 10 Pagantes all with arrival_order=1 (e.g. bulk checkin)
    for i in range(1, 11):
        players.append(Player(
            id=i,
            session_id=1,
            name=f"Pagante Lista {i}",
            is_confirmed=True,
            has_arrived=True,
            is_paying=True,
            arrival_order=1
        ))

    draw_teams(players)

    playing = [p for p in players if p.is_playing]
    waiting = [p for p in players if not p.is_playing]

    playing_ids = {p.id for p in playing}
    waiting_ids = {p.id for p in waiting}

    # IDs 1 to 8 should be playing, IDs 9 and 10 waiting
    assert playing_ids == {1, 2, 3, 4, 5, 6, 7, 8}
    assert waiting_ids == {9, 10}


def test_draw_teams_goalkeeper_paying_priority():
    """
    Ensures paying goalkeepers take priority over non-paying (liberado) goalkeepers.
    """
    gks = [
        Player(id=1, session_id=1, name="GK Liberado Cedo", is_goalkeeper=True, has_arrived=True, is_paying=False, arrival_order=1),
        Player(id=2, session_id=1, name="GK Pagante 1", is_goalkeeper=True, has_arrived=True, is_paying=True, arrival_order=2),
        Player(id=3, session_id=1, name="GK Pagante 2", is_goalkeeper=True, has_arrived=True, is_paying=True, arrival_order=3),
    ]
    # 8 field players so draw can proceed
    field = [
        Player(id=i+10, session_id=1, name=f"Linha {i}", is_goalkeeper=False, has_arrived=True, is_paying=True, arrival_order=i)
        for i in range(1, 9)
    ]

    all_players = gks + field
    draw_teams(all_players)

    playing_gks = [p for p in gks if p.is_playing]
    waiting_gks = [p for p in gks if not p.is_playing]

    assert len(playing_gks) == 2
    assert len(waiting_gks) == 1

    # The two paying GKs must be in court
    assert {p.id for p in playing_gks} == {2, 3}
    # The non-paying GK must be in waiting queue
    assert waiting_gks[0].id == 1
    assert waiting_gks[0].team_slot == 0


def test_draw_teams_anti_clique_distribution_in_queue():
    """
    Ensures that when there are multiple teams in the waiting queue,
    the waiting players are distributed across waiting teams and initial_draw_order
    is properly sequential.
    """
    # 16 players: 8 on court, 8 in queue (forming Time 3 and Time 4)
    players = []
    for i in range(1, 17):
        players.append(Player(
            id=i,
            session_id=1,
            name=f"Jogador {i}",
            has_arrived=True,
            is_paying=True,
            arrival_order=i
        ))

    draw_teams(players)

    playing = [p for p in players if p.is_playing]
    waiting = [p for p in players if not p.is_playing]

    assert len(playing) == 8
    assert len(waiting) == 8

    # initial_draw_order must be 1 to 16 without duplicates
    draw_orders = [p.initial_draw_order for p in players]
    assert sorted(draw_orders) == list(range(1, 17))

    # All waiting players should have initial_draw_order >= 9
    for p in waiting:
        assert p.initial_draw_order >= 9
        assert p.cycles_waiting == 1


def test_sort_entering_players_paying_priority():
    """
    Ensures that in the ongoing waiting queue (during match rotations),
    paying players take priority over liberados (is_paying=False)
    with the same cycles_waiting and matches_played.
    """
    p_liberado = Player(
        id=1, session_id=1, name="Liberado Cedo", has_arrived=True,
        is_paying=False, matches_played=0, cycles_waiting=1, arrival_order=1, initial_draw_order=9
    )
    p_pagante = Player(
        id=2, session_id=1, name="Pagante Tarde", has_arrived=True,
        is_paying=True, matches_played=0, cycles_waiting=1, arrival_order=2, initial_draw_order=10
    )

    waiting = [p_liberado, p_pagante]
    sorted_waiting = sort_entering_players(waiting)

    # Pagante must be ahead of liberado
    assert sorted_waiting[0].id == p_pagante.id
    assert sorted_waiting[1].id == p_liberado.id





