import random
from typing import List, Optional
from src.models.player import Player

PLAYERS_PER_TEAM = 4
TOTAL_PLAYERS_IN_COURT = PLAYERS_PER_TEAM * 2

from src.config import BALANCE_RULE_ENABLED, BALANCE_MAX_PER_TEAM, GOALKEEPERS_PER_TEAM

def draw_teams(active_players: List[Player]):
    """
    Randomizes all players to form Teams 1, 2, 3...
    Distributes Goalkeepers (1 per team) and Field players (4 per team).
    Respects category balance for field players (e.g. Jovens <= 1 per team).
    """
    import random
    
    gks = [p for p in active_players if getattr(p, 'is_goalkeeper', False)]
    field_players = [p for p in active_players if not getattr(p, 'is_goalkeeper', False)]
    
    # 1. Distribute Goalkeepers (1 for Team 1, 1 for Team 2, rest wait)
    random.shuffle(gks)
    for idx, gk in enumerate(gks):
        gk.initial_draw_order = idx + 1
        if idx == 0:
            gk.is_playing = True
            gk.team_slot = 1
            gk.cycles_in_court = 1
            gk.cycles_waiting = 0
            gk.draw_weight = random.uniform(0, 100)
        elif idx == 1:
            gk.is_playing = True
            gk.team_slot = 2
            gk.cycles_in_court = 1
            gk.cycles_waiting = 0
            gk.draw_weight = random.uniform(0, 100)
        else:
            gk.is_playing = False
            gk.team_slot = 0
            gk.cycles_waiting = 1
            gk.cycles_in_court = 0

    # 2. Distribute Field Players
    if BALANCE_RULE_ENABLED:
        special_players = [p for p in field_players if getattr(p, 'is_special_category', False)]
        regular_players = [p for p in field_players if not getattr(p, 'is_special_category', False)]
        random.shuffle(special_players)
        random.shuffle(regular_players)

        num_teams = max(2, (len(field_players) + PLAYERS_PER_TEAM - 1) // PLAYERS_PER_TEAM)
        team_buckets = [[] for _ in range(num_teams)]

        # Distribute special players across buckets (at most BALANCE_MAX_PER_TEAM per bucket while possible)
        b_idx = 0
        for sp in special_players:
            assigned = False
            for attempt in range(num_teams):
                curr = (b_idx + attempt) % num_teams
                spec_in_bucket = sum(1 for p in team_buckets[curr] if getattr(p, 'is_special_category', False))
                if spec_in_bucket < BALANCE_MAX_PER_TEAM and len(team_buckets[curr]) < PLAYERS_PER_TEAM:
                    team_buckets[curr].append(sp)
                    b_idx = curr + 1
                    assigned = True
                    break
            if not assigned:
                min_bucket = min(team_buckets, key=lambda b: (sum(1 for p in b if getattr(p, 'is_special_category', False)), len(b)))
                min_bucket.append(sp)

        # Fill buckets with regular players
        for rp in regular_players:
            for bucket in team_buckets:
                if len(bucket) < PLAYERS_PER_TEAM:
                    bucket.append(rp)
                    break
            else:
                team_buckets[-1].append(rp)

        shuffled = []
        for bucket in team_buckets:
            random.shuffle(bucket)
            shuffled.extend(bucket)
    else:
        shuffled = field_players[:]
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
            player.team_slot = 0
            player.cycles_waiting = 1
            player.cycles_in_court = 0

def sort_leaving_players(playing_players: List[Player]) -> List[Player]:
    """
    Order: cycles_in_court DESC, matches_played DESC, draw_weight DESC
    """
    return sorted(
        playing_players,
        key=lambda p: (p.cycles_in_court or 0, p.matches_played or 0, p.draw_weight or 0.0),
        reverse=True
    )

def sort_entering_players(waiting_players: List[Player]) -> List[Player]:
    """
    Order: cycles_waiting DESC, matches_played ASC, initial_draw_order ASC, arrival_order ASC
    A player who arrives late can only take priority over waiting players if those waiting have already played at least 1 match.
    Among players with the same number of matches played and cycle status, earlier arrivals take precedence (FIFO).
    """
    return sorted(
        waiting_players,
        key=lambda p: (-(p.cycles_waiting or 0), p.matches_played or 0, p.initial_draw_order or 9999, p.arrival_order or 0)
    )

def pick_entering_quartet(waiting_players: List[Player], max_special: int = 1) -> List[Player]:
    """
    Picks the next quartet of field players to enter from waiting_players, respecting max_special quota.
    Goalkeepers are excluded because they have their own dedicated queue.
    """
    waiting_field = [p for p in waiting_players if not getattr(p, 'is_goalkeeper', False)]
    sorted_waiting = sort_entering_players(waiting_field)
    if not sorted_waiting:
        return []
        
    if not BALANCE_RULE_ENABLED:
        return sorted_waiting[:PLAYERS_PER_TEAM]
        
    limit = max_special if max_special is not None else BALANCE_MAX_PER_TEAM
    selected = []
    special_count = 0
    remaining_pool = []
    
    for p in sorted_waiting:
        is_spec = getattr(p, 'is_special_category', False)
        if is_spec:
            if special_count < limit:
                selected.append(p)
                special_count += 1
            else:
                remaining_pool.append(p)
        else:
            selected.append(p)
            
        if len(selected) == PLAYERS_PER_TEAM:
            break
            
    # Fallback if remaining pool needed to reach PLAYERS_PER_TEAM
    if len(selected) < PLAYERS_PER_TEAM and remaining_pool:
        needed = PLAYERS_PER_TEAM - len(selected)
        selected.extend(remaining_pool[:needed])
        
    return selected

def pick_entering_goalkeeper(waiting_players: List[Player]) -> Optional[Player]:
    """
    Picks the next goalkeeper from the goalkeeper queue.
    """
    waiting_gks = [p for p in waiting_players if getattr(p, 'is_goalkeeper', False)]
    sorted_gks = sort_entering_players(waiting_gks)
    return sorted_gks[0] if sorted_gks else None

def _rotate_field_players(field_active: List[Player], winner: int = 0) -> List[Player]:
    """
    Process match rotation for outfield (field) players.
    """
    playing = [p for p in field_active if p.is_playing]
    waiting = [p for p in field_active if not p.is_playing]

    time_1 = [p for p in playing if p.team_slot == 1]
    time_2 = [p for p in playing if p.team_slot == 2]
    
    # Update Frag (V/E/D) stats for players on court
    if winner == 1:
        for p in time_1:
            p.wins = (p.wins or 0) + 1
        for p in time_2:
            p.losses = (p.losses or 0) + 1
    elif winner == 2:
        for p in time_2:
            p.wins = (p.wins or 0) + 1
        for p in time_1:
            p.losses = (p.losses or 0) + 1
    else:
        for p in playing:
            p.draws = (p.draws or 0) + 1
            
    if not waiting:
        # No one waiting, everyone stays in court.
        for p in playing:
            p.cycles_in_court = (p.cycles_in_court or 0) + 1
            p.matches_played = (p.matches_played or 0) + 1
        return []
        
    import random

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
            
            avg1 = sum(p.draw_weight or 0.0 for p in time_1) / len(time_1) if time_1 else 0
            avg2 = sum(p.draw_weight or 0.0 for p in time_2) / len(time_2) if time_2 else 0
            
            max_initial = max([p.initial_draw_order for p in waiting] + [0])
            
            # Sync to maintain quartets in the queue
            if avg1 >= avg2:
                for p in time_1: p.initial_draw_order = max_initial + 1
                for p in time_2: p.initial_draw_order = max_initial + 2
            else:
                for p in time_2: p.initial_draw_order = max_initial + 1
                for p in time_1: p.initial_draw_order = max_initial + 2
        else:
            leaving_pool = sort_leaving_players(playing)
            target_leaving = len(playing)
            
    sorted_waiting = sort_entering_players(waiting)
    
    missing_spots = TOTAL_PLAYERS_IN_COURT - len(playing)
    entering_count = min(len(waiting), target_leaving + missing_spots)
    leaving_count = max(0, entering_count - missing_spots)
    
    leaving = leaving_pool[:leaving_count]
    vacated_slots = [p.team_slot for p in leaving]
    
    t1_missing = max(0, PLAYERS_PER_TEAM - len(time_1))
    t2_missing = max(0, PLAYERS_PER_TEAM - len(time_2))
    missing_slots_list = [1] * t1_missing + [2] * t2_missing
    available_slots = vacated_slots + missing_slots_list
    
    vacancies_t1 = available_slots.count(1)
    vacancies_t2 = available_slots.count(2)
    
    staying_t1 = [p for p in time_1 if p not in leaving]
    staying_t2 = [p for p in time_2 if p not in leaving]
    s1_curr = sum(1 for p in staying_t1 if getattr(p, 'is_special_category', False))
    s2_curr = sum(1 for p in staying_t2 if getattr(p, 'is_special_category', False))
    
    entering_with_slots = []
    skipped_players = []
    v1_left = vacancies_t1
    v2_left = vacancies_t2
    
    for p in sorted_waiting:
        if v1_left == 0 and v2_left == 0:
            break
            
        is_spec = getattr(p, 'is_special_category', False) if BALANCE_RULE_ENABLED else False
        
        can_t1 = (v1_left > 0) and (not is_spec or s1_curr < BALANCE_MAX_PER_TEAM)
        can_t2 = (v2_left > 0) and (not is_spec or s2_curr < BALANCE_MAX_PER_TEAM)
        
        if can_t1 and can_t2:
            if v1_left >= v2_left:
                entering_with_slots.append((p, 1))
                v1_left -= 1
                if is_spec: s1_curr += 1
            else:
                entering_with_slots.append((p, 2))
                v2_left -= 1
                if is_spec: s2_curr += 1
        elif can_t1:
            entering_with_slots.append((p, 1))
            v1_left -= 1
            if is_spec: s1_curr += 1
        elif can_t2:
            entering_with_slots.append((p, 2))
            v2_left -= 1
            if is_spec: s2_curr += 1
        else:
            skipped_players.append(p)
            
    # Fallback if vacancies still remain and skipped players exist
    if (v1_left > 0 or v2_left > 0) and skipped_players:
        for p in skipped_players:
            if v1_left == 0 and v2_left == 0:
                break
            if v1_left > 0:
                entering_with_slots.append((p, 1))
                v1_left -= 1
            elif v2_left > 0:
                entering_with_slots.append((p, 2))
                v2_left -= 1
                
    entering = [p for p, _ in entering_with_slots]
    assigned_slots = [slot for _, slot in entering_with_slots]
    
    for p in leaving:
        p.is_playing = False
        p.team_slot = 0
        p.cycles_in_court = 0
        p.cycles_waiting = 1
        p.matches_played = (p.matches_played or 0) + 1
        
    for i, p in enumerate(entering):
        p.is_playing = True
        p.cycles_in_court = 1
        p.cycles_waiting = 0
        p.team_slot = assigned_slots[i] if i < len(assigned_slots) else (available_slots[i] if i < len(available_slots) else 2)
        p.draw_weight = random.uniform(0, 100)
        
    for p in playing:
        if p not in leaving:
            p.cycles_in_court = (p.cycles_in_court or 0) + 1
            p.matches_played = (p.matches_played or 0) + 1
            
    for p in waiting:
        if p not in entering:
            p.cycles_waiting = (p.cycles_waiting or 0) + 1
            
    return entering

def _rotate_goalkeepers(gk_active: List[Player], winner: int = 0) -> List[Player]:
    """
    Process match rotation for goalkeepers independently from field players.
    If there are goalkeepers waiting, the loser GK leaves and next waiting GK enters.
    If no goalkeepers are waiting, current GKs stay in court.
    """
    playing = [p for p in gk_active if p.is_playing]
    waiting = [p for p in gk_active if not p.is_playing]

    t1_gk = next((p for p in playing if p.team_slot == 1), None)
    t2_gk = next((p for p in playing if p.team_slot == 2), None)

    # Update stats
    if winner == 1:
        if t1_gk: t1_gk.wins = (t1_gk.wins or 0) + 1
        if t2_gk: t2_gk.losses = (t2_gk.losses or 0) + 1
    elif winner == 2:
        if t2_gk: t2_gk.wins = (t2_gk.wins or 0) + 1
        if t1_gk: t1_gk.losses = (t1_gk.losses or 0) + 1
    else:
        for p in playing:
            p.draws = (p.draws or 0) + 1

    if not waiting:
        # No GKs waiting: all currently playing GKs stay in court
        for p in playing:
            p.cycles_in_court = (p.cycles_in_court or 0) + 1
            p.matches_played = (p.matches_played or 0) + 1
        return []

    import random
    sorted_waiting = sort_entering_players(waiting)
    entering_gks = []

    if winner == 1:
        # Team 1 GK stays
        if t1_gk:
            t1_gk.cycles_in_court = (t1_gk.cycles_in_court or 0) + 1
            t1_gk.matches_played = (t1_gk.matches_played or 0) + 1
        # Team 2 GK leaves
        if t2_gk:
            t2_gk.is_playing = False
            t2_gk.team_slot = 0
            t2_gk.cycles_in_court = 0
            t2_gk.cycles_waiting = 1
            t2_gk.matches_played = (t2_gk.matches_played or 0) + 1
        next_gk = sorted_waiting[0]
        next_gk.is_playing = True
        next_gk.team_slot = 2
        next_gk.cycles_in_court = 1
        next_gk.cycles_waiting = 0
        next_gk.draw_weight = random.uniform(0, 100)
        entering_gks.append(next_gk)
        for w in sorted_waiting[1:]:
            w.cycles_waiting = (w.cycles_waiting or 0) + 1

    elif winner == 2:
        # Team 2 GK stays
        if t2_gk:
            t2_gk.cycles_in_court = (t2_gk.cycles_in_court or 0) + 1
            t2_gk.matches_played = (t2_gk.matches_played or 0) + 1
        # Team 1 GK leaves
        if t1_gk:
            t1_gk.is_playing = False
            t1_gk.team_slot = 0
            t1_gk.cycles_in_court = 0
            t1_gk.cycles_waiting = 1
            t1_gk.matches_played = (t1_gk.matches_played or 0) + 1
        next_gk = sorted_waiting[0]
        next_gk.is_playing = True
        next_gk.team_slot = 1
        next_gk.cycles_in_court = 1
        next_gk.cycles_waiting = 0
        next_gk.draw_weight = random.uniform(0, 100)
        entering_gks.append(next_gk)
        for w in sorted_waiting[1:]:
            w.cycles_waiting = (w.cycles_waiting or 0) + 1

    else:
        # Tie
        if len(waiting) >= 2 and t1_gk and t2_gk:
            # Both leave, next 2 enter
            for gk in [t1_gk, t2_gk]:
                gk.is_playing = False
                gk.team_slot = 0
                gk.cycles_in_court = 0
                gk.cycles_waiting = 1
                gk.matches_played = (gk.matches_played or 0) + 1
            gk1 = sorted_waiting[0]
            gk2 = sorted_waiting[1]
            gk1.is_playing = True; gk1.team_slot = 1; gk1.cycles_in_court = 1; gk1.cycles_waiting = 0; gk1.draw_weight = random.uniform(0, 100)
            gk2.is_playing = True; gk2.team_slot = 2; gk2.cycles_in_court = 1; gk2.cycles_waiting = 0; gk2.draw_weight = random.uniform(0, 100)
            entering_gks.extend([gk1, gk2])
            for w in sorted_waiting[2:]:
                w.cycles_waiting = (w.cycles_waiting or 0) + 1
        else:
            # 1 GK leaves: the one with more cycles_in_court
            leaving_pool = sort_leaving_players(playing)
            gk_out = leaving_pool[0]
            gk_stay = leaving_pool[1] if len(leaving_pool) > 1 else None
            if gk_stay:
                gk_stay.cycles_in_court = (gk_stay.cycles_in_court or 0) + 1
                gk_stay.matches_played = (gk_stay.matches_played or 0) + 1
            vacated_slot = gk_out.team_slot
            gk_out.is_playing = False
            gk_out.team_slot = 0
            gk_out.cycles_in_court = 0
            gk_out.cycles_waiting = 1
            gk_out.matches_played = (gk_out.matches_played or 0) + 1
            next_gk = sorted_waiting[0]
            next_gk.is_playing = True
            next_gk.team_slot = vacated_slot
            next_gk.cycles_in_court = 1
            next_gk.cycles_waiting = 0
            next_gk.draw_weight = random.uniform(0, 100)
            entering_gks.append(next_gk)
            for w in sorted_waiting[1:]:
                w.cycles_waiting = (w.cycles_waiting or 0) + 1

    return entering_gks

def rotate_players(active_players: List[Player], winner: int = 0):
    """
    Process one match rotation.
    Rotates field players (4 per team) and goalkeepers (1 per team, independently).
    """
    field_active = [p for p in active_players if not getattr(p, 'is_goalkeeper', False)]
    gk_active = [p for p in active_players if getattr(p, 'is_goalkeeper', False)]

    entering_field = _rotate_field_players(field_active, winner=winner)
    entering_gks = _rotate_goalkeepers(gk_active, winner=winner)

    return entering_field + entering_gks

def pull_next_player(active_players: List[Player], is_goalkeeper: bool = False) -> Optional[Player]:
    """
    Pulls a single player from the queue to the court, useful when someone leaves midway.
    Can pull a goalkeeper or a field player.
    """
    import random
    if is_goalkeeper:
        waiting_gks = [p for p in active_players if getattr(p, 'is_goalkeeper', False) and not p.is_playing]
        if not waiting_gks:
            return None
        playing_gks = [p for p in active_players if getattr(p, 'is_goalkeeper', False) and p.is_playing]
        t1_has_gk = any(p.team_slot == 1 for p in playing_gks)
        t2_has_gk = any(p.team_slot == 2 for p in playing_gks)
        if not t1_has_gk and not t2_has_gk:
            t1_count = sum(1 for p in active_players if p.is_playing and p.team_slot == 1)
            t2_count = sum(1 for p in active_players if p.is_playing and p.team_slot == 2)
            target_slot = 2 if t2_count < t1_count else 1
        elif not t1_has_gk:
            target_slot = 1
        else:
            target_slot = 2
        
        sorted_gks = sort_entering_players(waiting_gks)
        chosen = sorted_gks[0]
        chosen.is_playing = True
        chosen.cycles_waiting = 0
        chosen.cycles_in_court = 1
        chosen.team_slot = target_slot
        chosen.draw_weight = random.uniform(0, 100)
        return chosen
    else:
        waiting = [p for p in active_players if not getattr(p, 'is_goalkeeper', False) and not p.is_playing]
        if not waiting:
            return None
            
        playing = [p for p in active_players if not getattr(p, 'is_goalkeeper', False) and p.is_playing]
        time_1 = [p for p in playing if p.team_slot == 1]
        time_2 = [p for p in playing if p.team_slot == 2]
        slot = 1 if len(time_1) < PLAYERS_PER_TEAM else 2
        target_team = time_1 if slot == 1 else time_2
        
        sorted_waiting = sort_entering_players(waiting)
        special_in_target = sum(1 for p in target_team if getattr(p, 'is_special_category', False))
        
        chosen = None
        if BALANCE_RULE_ENABLED:
            for p in sorted_waiting:
                if getattr(p, 'is_special_category', False):
                    if special_in_target < BALANCE_MAX_PER_TEAM:
                        chosen = p
                        break
                else:
                    chosen = p
                    break
                    
        if not chosen and sorted_waiting:
            chosen = sorted_waiting[0]
            
        if chosen:
            chosen.is_playing = True
            chosen.cycles_waiting = 0
            chosen.cycles_in_court = 1
            chosen.team_slot = slot
            chosen.draw_weight = random.uniform(0, 100)
            return chosen
        return None
