import os
from datetime import datetime, timezone
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler
from src.database import SessionLocal
from src.services.session_service import create_session, get_active_session
from src.services.player_service import get_all_active_players, restart_session, release_player
import re
from src.engine.match import draw_teams, rotate_players
from src.engine.explainer import generate_queue_explanation, generate_teams_explanation
from src.bot.keyboards import get_dynamic_keyboard
from src.models.match_log import MatchLog

from src.models.player import Player

def get_base_url() -> str:
    return os.getenv("BASE_URL", "http://localhost:8686")

def format_session_links(session) -> str:
    base_url = get_base_url()
    public_url = f"{base_url}/#/match/{session.public_hash}"
    admin_url = f"{base_url}/#/match/{session.public_hash}?admin={session.admin_token}"
    checkin_code = getattr(session, "checkin_code", None) or session.public_hash
    checkin_url = f"{base_url}/#/checkin/{checkin_code}"
    return (
        f"📱 *Links da Pelada #{session.id}:*\n\n"
        f"📍 *Fazer Check-in (Cheguei):*\n{checkin_url}\n\n"
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
        
        result_title = "🏆 *Resultado:* Time 1 Venceu!" if winner == 1 else ("🏆 *Resultado:* Time 2 Venceu!" if winner == 2 else "🤝 *Resultado:* Empate na partida!")
        
        explanation = generate_teams_explanation(players, title=f"🔄 *Rotação Realizada!*\n{result_title}\n\n")
        if entering:
            names = ", ".join(p.name for p in entering)
            explanation = f"🚀 *Novo time em quadra:* **{names}**\n\n" + explanation
            
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

async def cmd_lista(update: Update, context: ContextTypes.DEFAULT_TYPE):
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
            
        all_players = db.query(Player).filter(Player.session_id == session.id).all()
        if not all_players:
            await msg.reply_text("📋 Nenhum jogador registrado nesta pelada ainda.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return

        from src.config import BALANCE_RULE_ENABLED, BALANCE_CATEGORY_EMOJI, GOALKEEPER_EMOJI, GOALKEEPER_LABEL
        
        total_players = len(all_players)
        confirmed_gks = [p for p in all_players if (p.is_confirmed or p.has_arrived) and p.is_goalkeeper]
        confirmed_paid = [p for p in all_players if (p.is_confirmed or p.has_arrived) and not p.is_goalkeeper and p.is_paying]
        confirmed_pending = [p for p in all_players if (p.is_confirmed or p.has_arrived) and not p.is_goalkeeper and not p.is_paying]
        absent_paid = [p for p in all_players if (not p.is_confirmed and not p.has_arrived) and p.is_paying]
        
        reply = f"📋 *Lista de Presença - Pelada #{session.id}*\n\n"

        reply += f"{GOALKEEPER_EMOJI} *{GOALKEEPER_LABEL}s* ({len(confirmed_gks)}):\n"
        if confirmed_gks:
            for idx, p in enumerate(confirmed_gks, 1):
                arrived_tag = " 🏟️" if p.has_arrived else ""
                youth_tag = f" {BALANCE_CATEGORY_EMOJI}" if (BALANCE_RULE_ENABLED and getattr(p, 'is_special_category', False)) else ""
                pay_tag = " (Pago)" if p.is_paying else " (Pendente)"
                reply += f"{idx} - {p.name}{youth_tag}{pay_tag}{arrived_tag}\n"
        else:
            reply += "_Nenhum_\n"
        reply += "\n"

        reply += f"🟢 *Presença confirmada (Linha - Pagos)* ({len(confirmed_paid)}):\n"
        if confirmed_paid:
            for idx, p in enumerate(confirmed_paid, 1):
                arrived_tag = " 🏟️" if p.has_arrived else ""
                youth_tag = f" {BALANCE_CATEGORY_EMOJI}" if (BALANCE_RULE_ENABLED and getattr(p, 'is_special_category', False)) else ""
                reply += f"{idx} - {p.name}{youth_tag}{arrived_tag}\n"
        else:
            reply += "_Nenhum_\n"
        reply += "\n"

        reply += f"⏳ *Presença confirmada (Linha - Pendente)* ({len(confirmed_pending)}):\n"
        if confirmed_pending:
            for idx, p in enumerate(confirmed_pending, 1):
                arrived_tag = " 🏟️" if p.has_arrived else ""
                youth_tag = f" {BALANCE_CATEGORY_EMOJI}" if (BALANCE_RULE_ENABLED and getattr(p, 'is_special_category', False)) else ""
                reply += f"{idx} - {p.name}{youth_tag}{arrived_tag}\n"
        else:
            reply += "_Nenhum_\n"
        reply += "\n"

        reply += f"🏖️ *Pagos que não irão* ({len(absent_paid)}):\n"
        if absent_paid:
            for idx, p in enumerate(absent_paid, 1):
                gk_tag = f" {GOALKEEPER_EMOJI}" if getattr(p, 'is_goalkeeper', False) else ""
                youth_tag = f" {BALANCE_CATEGORY_EMOJI}" if (BALANCE_RULE_ENABLED and getattr(p, 'is_special_category', False)) else ""
                reply += f"{idx} - {p.name}{gk_tag}{youth_tag}\n"
        else:
            reply += "_Nenhum_\n"
        reply += "\n"

        checkin_code = getattr(session, "checkin_code", None) or session.public_hash
        base_url = get_base_url()
        reply += f"📍 *Link de Check-in:* {base_url}/#/checkin/{checkin_code}"

        await msg.reply_text(reply, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_restart_session(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    if update.callback_query:
        await update.callback_query.answer()
        
    db = SessionLocal()
    try:
        active_session = get_active_session(db, chat_id)
        if not active_session:
            await msg.reply_text("Nenhuma pelada ativa.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        new_session = restart_session(db, active_session.id)
        links_text = format_session_links(new_session)
        reply = (
            f"🔄 *Pelada Recomeçada!*\n\n"
            f"A pelada anterior (#{active_session.id}) foi salva no histórico.\n"
            f"Uma nova pelada (#{new_session.id}) foi iniciada mantendo a lista de pagantes!\n\n"
            + links_text
        )
        await msg.reply_text(reply, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_release(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message or update.callback_query.message
    user = update.effective_user
    if update.callback_query:
        await update.callback_query.answer()
        
    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            await msg.reply_text("Nenhuma pelada ativa.", reply_markup=get_dynamic_keyboard(db, chat_id))
            return
            
        args_str = " ".join(context.args).strip() if context.args else ""
        if args_str:
            parts = re.split(r',|\s+e\s+', args_str)
            target_names = [p.strip().lstrip('@') for p in parts if p.strip()]
            target_telegram_id = None
            target_username = None
        else:
            target_names = [user.first_name]
            target_telegram_id = user.id
            target_username = user.username

        arrived_players = []
        for name in target_names:
            p, _ = release_player(db, session.id, name=name, telegram_id=target_telegram_id, telegram_username=target_username)
            arrived_players.append(p)
            
        names_str = ", ".join([p.name for p in arrived_players])
        orders_str = ", ".join([str(p.arrival_order) for p in arrived_players])
        reply_text = f"🔓 Chegada liberada para {names_str}! (Ordem: {orders_str})"
        
        players = get_all_active_players(db, session.id)
        is_rolling = any(p.is_playing for p in players)
        if is_rolling:
            reply_text += "\n\n" + generate_teams_explanation(players, title="🎲 *Situação Atual:*\n\n")
            
        await msg.reply_text(reply_text, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def cmd_import_wpp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    msg = update.message
    if not msg:
        return
    
    raw_text = msg.text or ""
    # Strip command prefix /importar
    raw_text = re.sub(r"^/(?:importar|importar_lista|wpp|lista_wpp)\s*", "", raw_text, flags=re.IGNORECASE).strip()
    
    if not raw_text:
        await msg.reply_text(
            "📋 *Como importar lista do WhatsApp:*\n\n"
            "Envie `/importar` seguido do texto copiado do WhatsApp, por exemplo:\n\n"
            "`/importar\n"
            "1 - jhimy\n"
            "2 - jefin\n"
            "3 - Danilo\n"
            "...`\n\n"
            "*(Ou apenas cole a lista numerada diretamente no grupo!)*",
            parse_mode="Markdown"
        )
        return

    from src.services.player_service import import_whatsapp_presence_list

    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            await msg.reply_text("⚽ Nenhuma pelada ativa. Use /nova_pelada para iniciar.")
            return

        imported = import_whatsapp_presence_list(db, session.id, raw_text)
        if not imported:
            await msg.reply_text("⚠️ Nenhum nome numerado foi identificado no texto enviado. Verifique o formato e tente novamente.")
            return

        reply = f"📋 *Lista do WhatsApp importada com sucesso!*\n"
        reply += f"✅ *{len(imported)} jogadores confirmados:*\n\n"
        for idx, p in enumerate(imported, 1):
            reply += f"{idx}. {p.name}\n"

        links_text = format_session_links(session)
        reply += f"\n" + links_text
        await msg.reply_text(reply, parse_mode="Markdown", reply_markup=get_dynamic_keyboard(db, chat_id))
    finally:
        db.close()

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query.data
    if query == "cmd_nova_pelada":
        await cmd_new_session(update, context)
    elif query == "cmd_recomecar":
        await cmd_restart_session(update, context)
    elif query == "cmd_sortear":
        await cmd_draw(update, context)
    elif query in ["cmd_proximo", "cmd_venceu_t1", "cmd_venceu_t2", "cmd_empate"]:
        await cmd_rotate(update, context)
    elif query == "cmd_fila":
        await cmd_queue(update, context)
    elif query == "cmd_lista":
        await cmd_lista(update, context)
    elif query == "cmd_link":
        await cmd_link(update, context)

handlers = [
    CommandHandler("start", start),
    CommandHandler("nova_pelada", cmd_new_session),
    CommandHandler("recomecar", cmd_restart_session),
    CommandHandler("sortear", cmd_draw),
    CommandHandler("proximo", cmd_rotate),
    CommandHandler("fila", cmd_queue),
    CommandHandler("lista", cmd_lista),
    CommandHandler("pagos", cmd_lista),
    CommandHandler("jogadores", cmd_lista),
    CommandHandler("importar", cmd_import_wpp),
    CommandHandler("importar_lista", cmd_import_wpp),
    CommandHandler("wpp", cmd_import_wpp),
    CommandHandler("link", cmd_link),
    CommandHandler("links", cmd_link),
    CommandHandler("liberar", cmd_release),
    CommandHandler("libera", cmd_release),
    CallbackQueryHandler(handle_callback)
]




