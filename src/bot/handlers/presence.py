import re
from telegram import Update
from telegram.ext import ContextTypes, MessageHandler, filters
from src.database import SessionLocal
from src.services.session_service import get_active_session
from src.services.player_service import (
    confirm_presence, cancel_presence, register_arrival, 
    get_confirmed_players, leave_presence, set_paying_status, 
    get_player, get_all_active_players, get_paying_players
)
from src.engine.match import pull_next_player
from src.engine.explainer import generate_teams_explanation
from src.bot.keyboards import get_dynamic_keyboard

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # If the user mentioned the bot, strip the bot's username from the beginning
    bot_username = context.bot.username.lower()
    text = update.message.text.strip().lower()
    
    # Remove @botname from the start of the message if present
    text = re.sub(rf'^@{bot_username}\s+', '', text)
    
    chat_id = update.effective_chat.id
    user = update.effective_user
    
    # We will use regex to check intents
    is_confirm = re.match(r'^(eu vou|vou|\+|👍)$', text)
    is_cancel = re.match(r'^(não vou|\-)$', text)
    is_arrival = re.match(r'^(eu cheguei|cheguei|t[oó] aqui)$', text)
    is_all_arrived = re.match(r'^(todos|todo mundo)\s+(chegou|chegaram)$', text)
    is_leave = re.match(r'^(sai|eu sai|fui|fui embora)$', text)
    is_step_down = re.match(r'^(desci|vou descer)$', text)
    
    is_pay = re.match(r'^(eu paguei|paguei)$', text)
    is_not_pay = re.match(r'^(eu n[aã]o paguei|n[aã]o paguei)$', text)
    
    # Check for mentions (multiple names supported)
    mention_cancel_1 = re.match(r'^@?(.+?)\s+n[aã]o\s+(vai|v[aã]o)$', text)
    mention_confirm_1 = re.match(r'^@?(.+?)\s+(vai|v[aã]o)$', text) if not mention_cancel_1 else None
    mention_confirm_2 = re.match(r'^(vai|v[aã]o)\s+@?(.+)$', text) if not mention_cancel_1 else None
    mention_arrival_1 = re.match(r'^@?(.+?)\s+(chegou|chegaram|chego)$', text) if not is_all_arrived else None
    mention_leave_1 = re.match(r'^@?(.+?)\s+(saiu|sa[ií]ram)$', text)
    mention_step_down_1 = re.match(r'^@?(.+?)\s+(desce|desse|desseu|desceu|vai descer|desceram|vai desser|vai desse|desseram|desserao|v[aã]o descer)$', text)
    
    mention_not_pay_1 = re.match(r'^@?(.+?)\s+n[aã]o\s+pagou$', text)
    mention_pay_1 = re.match(r'^@?(.+?)\s+(pagou|pagaro|pagaram|pagarao)$', text) if not mention_not_pay_1 else None
    
    # Only proceed if we match something
    if not any([is_confirm, is_cancel, is_arrival, is_all_arrived, mention_confirm_1, mention_confirm_2, mention_cancel_1, mention_arrival_1, is_leave, mention_leave_1, is_step_down, mention_step_down_1, is_pay, is_not_pay, mention_pay_1, mention_not_pay_1]):
        return

    db = SessionLocal()
    try:
        session = get_active_session(db, chat_id)
        if not session:
            return
            
        def parse_names(names_str: str):
            parts = re.split(r',|\s+e\s+', names_str)
            return [p.strip().lstrip('@') for p in parts if p.strip()]
            
        target_names = [user.first_name]
        target_telegram_id = user.id
        target_username = user.username
        is_mention = False
        
        if mention_confirm_1:
            target_names = parse_names(mention_confirm_1.group(1))
            is_mention = True
        elif mention_confirm_2:
            target_names = parse_names(mention_confirm_2.group(2))
            is_mention = True
        elif mention_cancel_1:
            target_names = parse_names(mention_cancel_1.group(1))
            is_mention = True
        elif mention_arrival_1:
            target_names = parse_names(mention_arrival_1.group(1))
            is_mention = True
        elif mention_leave_1:
            target_names = parse_names(mention_leave_1.group(1))
            is_mention = True
        elif mention_step_down_1:
            target_names = parse_names(mention_step_down_1.group(1))
            is_mention = True
        elif mention_pay_1:
            target_names = parse_names(mention_pay_1.group(1))
            is_mention = True
        elif mention_not_pay_1:
            target_names = parse_names(mention_not_pay_1.group(1))
            is_mention = True
            
        if is_mention:
            target_telegram_id = None
            
        keyboard = get_dynamic_keyboard(db, chat_id)
        
        if is_confirm or mention_confirm_1 or mention_confirm_2:
            for name in target_names:
                confirm_presence(db, session.id, name=name, telegram_id=target_telegram_id, telegram_username=target_username)
            
            confirmed = get_confirmed_players(db, session.id)
            names_str = ", ".join(target_names)
            list_text = f"✅ Presença confirmada para {names_str}!\n\n📋 *Confirmados ({len(confirmed)}):*\n"
            for idx, p in enumerate(confirmed, 1):
                icon = "✅ " if p.is_paying else ""
                list_text += f"{idx}. {icon}{p.name}\n"
                
            await update.message.reply_text(list_text, reply_markup=keyboard, parse_mode="Markdown")
            
        elif is_cancel or mention_cancel_1:
            success_names = []
            failed_names = []
            for name in target_names:
                success = cancel_presence(db, session.id, name=name, telegram_id=target_telegram_id)
                if success:
                    success_names.append(name)
                else:
                    failed_names.append(name)
                    
            if success_names:
                confirmed = get_confirmed_players(db, session.id)
                names_str = ", ".join(success_names)
                list_text = f"❌ Presença cancelada para {names_str}.\n\n📋 *Confirmados ({len(confirmed)}):*\n"
                for idx, p in enumerate(confirmed, 1):
                    icon = "✅ " if p.is_paying else ""
                    list_text += f"{idx}. {icon}{p.name}\n"
                await update.message.reply_text(list_text, reply_markup=keyboard, parse_mode="Markdown")
            if failed_names:
                names_str = ", ".join(failed_names)
                await update.message.reply_text(f"⚠️ {names_str} não estava(m) confirmado(s).", reply_markup=keyboard)
                
        elif is_all_arrived:
            paying_players = get_paying_players(db, session.id)
            if not paying_players:
                await update.message.reply_text("⚠️ Nenhum jogador da lista de presença consta como pagante ainda.", reply_markup=keyboard)
            else:
                arrived_players = []
                already_arrived = []
                for p_paying in paying_players:
                    player, is_new = register_arrival(db, session.id, name=p_paying.name, telegram_id=p_paying.telegram_id, telegram_username=p_paying.telegram_username)
                    if is_new:
                        arrived_players.append(player)
                    else:
                        already_arrived.append(player)
                
                if arrived_players:
                    names_str = ", ".join([p.name for p in arrived_players])
                    reply_text = f"📍 Chegada confirmada para os pagantes da lista de presença! ({names_str})"
                    
                    players = get_all_active_players(db, session.id)
                    is_rolling = any(p.is_playing for p in players)
                    if is_rolling:
                        reply_text += "\n\n" + generate_teams_explanation(players, title="🎲 *Situação Atual:*\n\n")
                        
                    await update.message.reply_text(reply_text, reply_markup=keyboard, parse_mode="Markdown")
                else:
                    await update.message.reply_text("📍 Todos os pagantes da lista de presença já haviam feito check-in.", reply_markup=keyboard)

        elif is_arrival or mention_arrival_1:
            arrived_players = []
            duplicate_names = []
            not_paying_names = []
            
            for name in target_names:
                player = get_player(db, session.id, name=name, telegram_id=target_telegram_id)
                is_paying = player.is_paying if player else False
                
                if not is_paying:
                    not_paying_names.append(name)
                    continue
                    
                player, is_new = register_arrival(db, session.id, name=name, telegram_id=target_telegram_id, telegram_username=target_username)
                if is_new:
                    arrived_players.append(player)
                else:
                    duplicate_names.append(name)
                    
            if not_paying_names:
                names_str = ", ".join(not_paying_names)
                await update.message.reply_text(f"⚠️ {names_str} não pode confirmar chegada porque não pagou! Avise o pagamento primeiro (ex: `{names_str} pagou`).", reply_markup=keyboard, parse_mode="Markdown")
                
            if duplicate_names:
                names_str = ", ".join(duplicate_names)
                await update.message.reply_text(
                    f"⚠️ *{names_str}* já fez check-in!\nSe você for outra pessoa com o mesmo nome, mande a mensagem com um sobrenome (ex: `{names_str} da Silva chegou`).",
                    reply_markup=keyboard,
                    parse_mode="Markdown"
                )
                
            if arrived_players:
                names_str = ", ".join([p.name for p in arrived_players])
                orders_str = ", ".join([str(p.arrival_order) for p in arrived_players])
                reply_text = f"📍 {names_str} chegou! (Ordem: {orders_str})"
                
                players = get_all_active_players(db, session.id)
                is_rolling = any(p.is_playing for p in players)
                
                if is_rolling:
                    reply_text += "\n\n" + generate_teams_explanation(players, title="🎲 *Situação Atual:*\n\n")
                    
                await update.message.reply_text(reply_text, reply_markup=keyboard, parse_mode="Markdown")

        elif is_leave or mention_leave_1:
            left_names = []
            missing_names = []
            replaced_by = []
            
            for name in target_names:
                success, was_playing = leave_presence(db, session.id, name=name, telegram_id=target_telegram_id)
                if success:
                    left_names.append(name)
                    if was_playing:
                        players = get_all_active_players(db, session.id)
                        new_player = pull_next_player(players)
                        if new_player:
                            db.commit()
                            replaced_by.append(new_player.name)
                else:
                    missing_names.append(name)
                    
            if left_names:
                names_str = ", ".join(left_names)
                reply_text = f"👋 {names_str} saiu da pelada."
                if replaced_by:
                    rep_str = ", ".join(replaced_by)
                    reply_text += f"\n🔄 {rep_str} entrou na quadra nas vagas que abriram!"
                elif len(replaced_by) < len([n for n in left_names]): # Some were playing but couldn't be replaced
                    # Actually we don't have enough granularity here to know if they were playing, but it's fine
                    pass
                await update.message.reply_text(reply_text, reply_markup=keyboard)
                
            if missing_names:
                names_str = ", ".join(missing_names)
                await update.message.reply_text(f"⚠️ {names_str} não estava(m) na pelada.", reply_markup=keyboard)
                
        elif is_step_down or mention_step_down_1:
            stepped_down = []
            not_playing = []
            replaced_by = []
            
            for name in target_names:
                player = get_player(db, session.id, name=name, telegram_id=target_telegram_id)
                if player and player.has_arrived and player.is_playing:
                    player.is_playing = False
                    player.cycles_in_court = 0
                    player.cycles_waiting = 0  # Must be 0 so they don't jump ahead of people currently waiting mid-cycle
                    
                    db.commit() # Save their status so pull_next_player sees they aren't playing
                    
                    players = get_all_active_players(db, session.id)
                    new_player = pull_next_player(players)
                    if new_player:
                        db.commit()
                        replaced_by.append(new_player.name)
                        
                    stepped_down.append(name)
                else:
                    not_playing.append(name)
                    
            if stepped_down:
                names_str = ", ".join(stepped_down)
                reply_text = f"🪑 {names_str} desceu(ram) da quadra para descansar."
                if replaced_by:
                    rep_str = ", ".join(replaced_by)
                    reply_text += f"\n🔄 {rep_str} entrou na quadra nas vagas que abriram!"
                elif len(replaced_by) < len(stepped_down):
                    reply_text += f"\n⚠️ A quadra ficou incompleta pois não há gente suficiente na fila."
                    
                current_players = get_all_active_players(db, session.id)
                reply_text += "\n\n" + generate_teams_explanation(current_players, title="🎲 *Situação Atual:*\n\n")
                
                await update.message.reply_text(reply_text, reply_markup=keyboard, parse_mode="Markdown")
                
            if not_playing:
                names_str = ", ".join(not_playing)
                await update.message.reply_text(f"⚠️ {names_str} não estava(m) jogando.", reply_markup=keyboard)

        elif is_pay or mention_pay_1:
            for name in target_names:
                set_paying_status(db, session.id, name=name, is_paying=True, telegram_id=target_telegram_id, telegram_username=target_username)
            names_str = ", ".join(target_names)
            
            confirmed = get_confirmed_players(db, session.id)
            list_text = f"💰 Pagamento confirmado para {names_str}!\n\n📋 *Confirmados ({len(confirmed)}):*\n"
            for idx, p in enumerate(confirmed, 1):
                icon = "✅ " if p.is_paying else ""
                list_text += f"{idx}. {icon}{p.name}\n"
                
            await update.message.reply_text(list_text, reply_markup=keyboard, parse_mode="Markdown")

        elif is_not_pay or mention_not_pay_1:
            for name in target_names:
                set_paying_status(db, session.id, name=name, is_paying=False, telegram_id=target_telegram_id, telegram_username=target_username)
            names_str = ", ".join(target_names)
            await update.message.reply_text(f"❌ Status de pagamento cancelado para {names_str}.", reply_markup=keyboard)
                
    finally:
        db.close()

presence_handler = MessageHandler(filters.TEXT & (~filters.COMMAND), handle_text)
