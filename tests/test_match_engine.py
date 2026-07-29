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



