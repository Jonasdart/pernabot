from typing import List
import random
from src.engine.match import sort_entering_players, sort_leaving_players, PLAYERS_PER_TEAM
from src.models.player import Player

def get_team_captains(playing_players: List[Player]):
    time_1 = [p for p in playing_players if p.team_slot == 1]
    time_2 = [p for p in playing_players if p.team_slot == 2]

    ordered_t1 = sort_leaving_players(time_1)
    ordered_t1.reverse()

    ordered_t2 = sort_leaving_players(time_2)
    ordered_t2.reverse()

    c1 = ordered_t1[0] if ordered_t1 else None
    c2 = ordered_t2[0] if ordered_t2 else None

    if c1 and c2 and c1.name and c2.name:
        fn1 = c1.name.strip().split()[0].title()
        fn2 = c2.name.strip().split()[0].title()
        if fn1.lower() == fn2.lower():
            found_alt = False
            for alt in ordered_t2[1:]:
                alt_fn = alt.name.strip().split()[0].title() if alt.name else ""
                if alt_fn.lower() != fn1.lower():
                    c2 = alt
                    found_alt = True
                    break
            if not found_alt:
                for alt in ordered_t1[1:]:
                    alt_fn = alt.name.strip().split()[0].title() if alt.name else ""
                    if alt_fn.lower() != fn2.lower():
                        c1 = alt
                        found_alt = True
                        break

    return c1, c2

def generate_teams_explanation(players: List[Player], title: str = "🎲 *Times Formados!*\n\n") -> str:
    playing = [p for p in players if p.is_playing]
    
    time_1 = [p for p in playing if p.team_slot == 1]
    time_2 = [p for p in playing if p.team_slot == 2]
    
    ordered_t1 = sort_leaving_players(time_1)
    ordered_t1.reverse()

    ordered_t2 = sort_leaving_players(time_2)
    ordered_t2.reverse()

    c1, c2 = get_team_captains(playing)
    t1_captain = c1.name if c1 else None
    t2_captain = c2.name if c2 else None

    t1_label = f"Time {t1_captain}" if t1_captain else "Time 1"
    t2_label = f"Time {t2_captain}" if t2_captain else "Time 2"

    text = title
    if t1_captain and t2_captain:
        text += f"⚔️ *{t1_label}* vs *{t2_label}*\n\n"

    if time_1:
        text += f"⚽ *{t1_label}:*\n"
        for idx, p in enumerate(ordered_t1, 1):
            text += f"{idx}. {p.name}\n"
            
    if time_2:
        text += f"\n⚽ *{t2_label}:*\n"
        for idx, p in enumerate(ordered_t2, 1):
            text += f"{idx}. {p.name}\n"
            
    text += "\n"
            
    waiting = [p for p in players if not p.is_playing]
    sorted_waiting = sort_entering_players(waiting)
    
    if sorted_waiting:
        team_idx = 1
        idx = 0
        global_idx = 1
        while idx + PLAYERS_PER_TEAM <= len(sorted_waiting):
            if team_idx == 1:
                text += "\n⏳ *Próxima:*\n"
            else:
                text += f"\n⏳ *Próxima {team_idx}:*\n"
            for p in sorted_waiting[idx:idx+PLAYERS_PER_TEAM]:
                text += f"{global_idx}. {p.name}\n"
                global_idx += 1
            idx += PLAYERS_PER_TEAM
            team_idx += 1
            
        avulsos = sorted_waiting[idx:]
        if avulsos:
            text += "\n🧍 *Avulsos (Aguardando):*\n"
            for p in avulsos:
                text += f"{global_idx}. {p.name}\n"
                global_idx += 1
                
    return text

def generate_queue_explanation(players: List[Player]) -> str:
    """
    Generates a textual representation of the current queue (waiting) 
    and who is in court (playing), including the reasoning (metrics).
    """
    waiting = [p for p in players if not p.is_playing]
    playing = [p for p in players if p.is_playing]
    
    sorted_waiting = sort_entering_players(waiting)
    sorted_playing = sort_leaving_players(playing)
    
    text = "📋 *Fila de Espera (Próximos a Entrar)*\n"
    if not sorted_waiting:
        text += "Ninguém aguardando.\n"
    else:
        for idx, p in enumerate(sorted_waiting, 1):
            text += f"{idx}. {p.name} (Espera: {p.cycles_waiting} | Partidas: {p.matches_played} | Chegada: {p.arrival_order})\n"
            
    text += "\n⚽ *Jogadores em Quadra (Próximos a Sair)*\n"
    if not sorted_playing:
        text += "Quadra vazia.\n"
    else:
        for idx, p in enumerate(sorted_playing, 1):
            text += f"{idx}. {p.name} (Em Quadra: {p.cycles_in_court} | Partidas: {p.matches_played} | Sorteio: {p.draw_weight:.2f})\n"
            
    text += "\n_Lógica de entrada: Mais tempo esperando > Menos partidas > Sorteio Inicial > Chegada_\n"
    text += "_Lógica de saída: Mais tempo em quadra > Mais partidas jogadas > Sorteio inicial_"
    
    return text
