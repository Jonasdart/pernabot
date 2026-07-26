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

