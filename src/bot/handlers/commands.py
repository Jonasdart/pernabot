import os
from datetime import datetime, timezone
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler
from src.database import SessionLocal
from src.services.session_service import create_session, get_active_session
from src.services.player_service import get_all_active_players
from src.engine.match import draw_teams, rotate_players
from src.engine.explainer import generate_queue_explanation, generate_teams_explanation
from src.bot.keyboards import get_dynamic_keyboard
from src.models.match_log import MatchLog

def get_base_url() -> str:
    return os.getenv("BASE_URL", "http://localhost:8000")

def format_session_links(session) -> str:
    base_url = get_base_url()
    public_url = f"{base_url}/#/match/{session.public_hash}"
    admin_url = f"{base_url}/#/match/{session.public_hash}?admin={session.admin_token}"
    return (
        f"📱 *Links da Pelada #{session.id}:*\n\n"
        f"👁️ *Link Público (Quadra ao Vivo):*\n{public_url}\n\n"
        f"⚡ *Link de Gerenciador (Marcar Vencedores/Descer/Sair):*\n{admin_url}"
    )

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message or update.callback_query.message
    chat_id = update.effective_chat.id
    db = SessionLocal()
    try:
        await msg.reply_text(
            "Bem-vindo ao Pernabot! Use os botões abaixo para gerenciar a pelada.",
            reply_markup=get_dynamic_keyboard(db, chat_id)
        )
    finally:
        db.close()

async def cmd_new_session(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    if update.callback_query:
        await update.callback_query.answer()
        
    db = SessionLocal()
    try:
        session = create_session(db, chat_id)
        links_text = format_session_links(session)
        reply = f"⚽ *Nova pelada iniciada! Sessão #{session.id}*\nPodem confirmar presença!\n\n" + links_text
        await msg.reply_text(reply, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    if update.callback_query:
        await update.callback_query.answer()
        
    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            await msg.reply_text("Nenhuma pelada ativa. Use /nova_pelada.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        links_text = format_session_links(session)
        await msg.reply_text(links_text, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_draw(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    if update.callback_query:
        await update.callback_query.answer()
        
    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            await msg.reply_text("Nenhuma pelada ativa. Use /nova_pelada.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        players = get_all_active_players(db, session.id)
        if len(players) < 8:
            await msg.reply_text(f"⚠️ O sorteio só pode ser realizado com no mínimo 8 jogadores com chegada confirmada! (Atualmente: {len(players)})", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        draw_teams(players)
        
        # Log match draw event
        event_time = datetime.now(timezone.utc)
        match_log = MatchLog(session_id=session.id, event_type="draw", created_at=event_time)
        db.add(match_log)
        
        db.commit()
        
        explanation = generate_teams_explanation(players)
        await msg.reply_text(explanation, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_rotate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    query_data = ""
    if update.callback_query:
        query_data = update.callback_query.data
        await update.callback_query.answer()
        
    winner = 0
    if query_data == "cmd_venceu_t1":
        winner = 1
    elif query_data == "cmd_venceu_t2":
        winner = 2
        
    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            await msg.reply_text("Nenhuma pelada ativa.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        players = get_all_active_players(db, session.id)
        entering = rotate_players(players, winner=winner)
        
        # Log match rotation event
        event_time = datetime.now(timezone.utc)
        match_log = MatchLog(session_id=session.id, event_type="rotate", created_at=event_time)
        db.add(match_log)
        
        db.commit()
        
        explanation = generate_teams_explanation(players, title="🔄 *Rotação Realizada!*\n\n")
        if entering:
            names = ", ".join(p.name for p in entering)
            explanation = f"✅ **Entraram na quadra:** {names}\n\n" + explanation
            
        await msg.reply_text(explanation, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_queue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    if update.callback_query:
        await update.callback_query.answer()
        
    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            await msg.reply_text("Nenhuma pelada ativa.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        players = get_all_active_players(db, session.id)
        explanation = generate_queue_explanation(players)
        await msg.reply_text(explanation, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query.data
    if query == "cmd_nova_pelada":
        await cmd_new_session(update, context)
    elif query == "cmd_sortear":
        await cmd_draw(update, context)
    elif query in ["cmd_proximo", "cmd_venceu_t1", "cmd_venceu_t2", "cmd_empate"]:
        await cmd_rotate(update, context)
    elif query == "cmd_fila":
        await cmd_queue(update, context)
    elif query == "cmd_link":
        await cmd_link(update, context)

handlers = [
    CommandHandler("start", start),
    CommandHandler("nova_pelada", cmd_new_session),
    CommandHandler("sortear", cmd_draw),
    CommandHandler("proximo", cmd_rotate),
    CommandHandler("fila", cmd_queue),
    CommandHandler("link", cmd_link),
    CommandHandler("links", cmd_link),
    CallbackQueryHandler(handle_callback)
]

