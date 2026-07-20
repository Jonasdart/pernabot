from telegram import InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy.orm import Session as DbSession
from src.services.session_service import get_active_session
from src.services.player_service import get_all_active_players

from src.engine.explainer import get_team_captains

def get_dynamic_keyboard(db: DbSession, chat_id: int) -> InlineKeyboardMarkup:
    session = get_active_session(db, chat_id)
    
    if not session:
        keyboard = [
            [InlineKeyboardButton("⚽ Nova Pelada", callback_data="cmd_nova_pelada")]
        ]
        return InlineKeyboardMarkup(keyboard)
        
    players = get_all_active_players(db, session.id)
    is_playing = any(p.is_playing for p in players)
    
    if not is_playing:
        keyboard = [
            [InlineKeyboardButton("🎲 Sortear", callback_data="cmd_sortear")],
            [InlineKeyboardButton("🛑 Encerrar Pelada", callback_data="cmd_nova_pelada")]
        ]
    else:
        playing = [p for p in players if p.is_playing]
        c1, c2 = get_team_captains(playing)
        
        t1_captain = c1.name.strip().split()[0].title() if (c1 and c1.name) else "T1"
        t2_captain = c2.name.strip().split()[0].title() if (c2 and c2.name) else "T2"

        keyboard = [
            [
                InlineKeyboardButton(f"🏆 {t1_captain} Ganhou", callback_data="cmd_venceu_t1"),
                InlineKeyboardButton(f"🏆 {t2_captain} Ganhou", callback_data="cmd_venceu_t2")
            ],
            [InlineKeyboardButton("🤝 Empate", callback_data="cmd_empate"), InlineKeyboardButton("📋 Ver Fila", callback_data="cmd_fila")],
            [InlineKeyboardButton("🛑 Encerrar Pelada", callback_data="cmd_nova_pelada")]
        ]
        
    return InlineKeyboardMarkup(keyboard)
