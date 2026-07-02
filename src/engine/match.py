import random
from typing import List
from src.models.player import Player

PLAYERS_PER_TEAM = 4
TOTAL_PLAYERS_IN_COURT = PLAYERS_PER_TEAM * 2

def draw_teams(active_players: List[Player]):
    """
    Randomizes all players to form Teams 1, 2, 3...
    The first 8 play, the rest wait, but their initial_draw_order is assigned 
    so they stay grouped in random teams in the queue without destroying arrival_order.
    """
    import random
    
    shuffled = active_players[:]
    random.shuffle(shuffled)
    
    for idx, player in enumerate(shuffled):
        # Assign initial_draw_order so they form contiguous teams in the queue
        player.initial_draw_order = idx + 1
        
        if idx < TOTAL_PLAYERS_IN_COURT:
            player.is_playing = True
            player.cycles_in_court = 1
            player.cycles_waiting = 0
            player.team_slot = 1 if idx < PLAYERS_PER_TEAM else 2
            player.draw_weight = random.uniform(0, 100)
        else:
            player.is_playing = False
            player.cycles_waiting = 1
            player.cycles_in_court = 0

def sort_leaving_players(playing_players: List[Player]) -> List[Player]:
    """
    Order: cycles_in_court DESC, matches_played DESC, draw_weight DESC
    """
    return sorted(
        playing_players,
        key=lambda p: (p.cycles_in_court, p.matches_played, p.draw_weight),
        reverse=True
    )

def sort_entering_players(waiting_players: List[Player]) -> List[Player]:
    """
    Order: cycles_waiting DESC, matches_played ASC, initial_draw_order ASC, arrival_order dynamic
    If matches_played == 0 (new arrival): prioritize LATEST arrival (-arrival_order)
    If matches_played > 0 (already played): prioritize OLDEST arrival (arrival_order)
    """
    return sorted(
        waiting_players,
        key=lambda p: (-p.cycles_waiting, p.matches_played, p.initial_draw_order, -p.arrival_order if p.matches_played == 0 else p.arrival_order)
    )

def rotate_players(active_players: List[Player], winner: int = 0):
    """
    Process one match rotation.
    winner: 0 (default rules), 1 (Time 1 won, Time 2 leaves), 2 (Time 2 won, Time 1 leaves)
    """
    playing = [p for p in active_players if p.is_playing]
    waiting = [p for p in active_players if not p.is_playing]
    
    if not waiting:
        # No one waiting, everyone stays in court.
        for p in playing:
            p.cycles_in_court += 1
        return []
        
    import random
    time_1 = [p for p in playing if p.team_slot == 1]
    time_2 = [p for p in playing if p.team_slot == 2]
    
    if winner == 1:
        leaving_pool = sort_leaving_players(time_2)
        target_leaving = len(time_2)
    elif winner == 2:
        leaving_pool = sort_leaving_players(time_1)
        target_leaving = len(time_1)
    else:
        # Empate
        if len(waiting) >= TOTAL_PLAYERS_IN_COURT:
            # 8+ waiting: Both teams leave, maintaining quartets sorted by avg draw weight
            leaving_pool = time_1 + time_2
            target_leaving = len(playing)
            
            avg1 = sum(p.draw_weight for p in time_1) / len(time_1) if time_1 else 0
            avg2 = sum(p.draw_weight for p in time_2) / len(time_2) if time_2 else 0
            
            max_initial = max([p.initial_draw_order for p in waiting] + [0])
            
            # Sync to maintain quartets in the queue
            if avg1 >= avg2:
                for p in time_1: p.initial_draw_order = max_initial + 1
                for p in time_2: p.initial_draw_order = max_initial + 2
            else:
                for p in time_2: p.initial_draw_order = max_initial + 1
                for p in time_1: p.initial_draw_order = max_initial + 2
                
            max_matches_t1 = max([p.matches_played for p in time_1] + [0])
            for p in time_1: p.matches_played = max_matches_t1
            
            max_matches_t2 = max([p.matches_played for p in time_2] + [0])
            for p in time_2: p.matches_played = max_matches_t2
        else:
            leaving_pool = sort_leaving_players(playing)
            target_leaving = len(playing)
            
    sorted_waiting = sort_entering_players(waiting)
    
    missing_spots = TOTAL_PLAYERS_IN_COURT - len(playing)
    entering_count = min(len(waiting), target_leaving + missing_spots)
    leaving_count = max(0, entering_count - missing_spots)
    
    leaving = leaving_pool[:leaving_count]
    entering = sorted_waiting[:entering_count]
    
    vacated_slots = [p.team_slot for p in leaving]
    
    t1_missing = max(0, PLAYERS_PER_TEAM - len(time_1))
    t2_missing = max(0, PLAYERS_PER_TEAM - len(time_2))
    missing_slots_list = [1] * t1_missing + [2] * t2_missing
    
    available_slots = vacated_slots + missing_slots_list
    
    for p in leaving:
        p.is_playing = False
        p.cycles_in_court = 0
        p.cycles_waiting = 1
        p.matches_played += 1
        
    for i, p in enumerate(entering):
        p.is_playing = True
        p.cycles_in_court = 1
        p.cycles_waiting = 0
        p.team_slot = available_slots[i] if i < len(available_slots) else 2
        p.draw_weight = random.uniform(0, 100)
        
    for p in playing:
        if p not in leaving:
            p.cycles_in_court += 1
            p.matches_played += 1
            
    for p in waiting:
        if p not in entering:
            p.cycles_waiting += 1
            
    return entering

def pull_next_player(active_players: List[Player]) -> Player:
    """
    Pulls a single player from the queue to the court, useful when someone leaves midway.
    """
    waiting = [p for p in active_players if not p.is_playing]
    if not waiting:
        return None
        
    playing = [p for p in active_players if p.is_playing]
    time_1 = [p for p in playing if p.team_slot == 1]
    slot = 1 if len(time_1) < PLAYERS_PER_TEAM else 2
        
    entering = sort_entering_players(waiting)[:1]
    if entering:
        import random
        p = entering[0]
        p.is_playing = True
        p.cycles_waiting = 0
        p.cycles_in_court = 1
        p.team_slot = slot
        p.draw_weight = random.uniform(0, 100)
        return p
    return None
