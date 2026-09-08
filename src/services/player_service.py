import uuid
import re
from datetime import datetime, timezone
from sqlalchemy.orm import Session as DbSession
from sqlalchemy import func
from src.models.player import Player
from src.models.session import Session


def get_player(db: DbSession, session_id: int, name: str = None, telegram_id: int = None):
    query = db.query(Player).filter(Player.session_id == session_id)
    if telegram_id:
        query = query.filter(Player.telegram_id == telegram_id)
    elif name:
        # Case insensitive exact match or some better logic later
        query = query.filter(func.lower(Player.name) == name.lower())
    else:
        return None
    return query.first()

def confirm_presence(db: DbSession, session_id: int, name: str, telegram_id: int = None, telegram_username: str = None, category: str = None, is_goalkeeper: bool = None):
    player = get_player(db, session_id, name=name, telegram_id=telegram_id)
    if not player:
        player = Player(
            session_id=session_id,
            name=name,
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            is_confirmed=True,
            category=category or "default",
            is_goalkeeper=bool(is_goalkeeper) if is_goalkeeper is not None else False
        )
        db.add(player)
    else:
        player.is_confirmed = True
        if category:
            player.category = category
        if is_goalkeeper is not None:
            player.is_goalkeeper = bool(is_goalkeeper)
        if telegram_id:
            player.telegram_id = telegram_id
        if telegram_username:
            player.telegram_username = telegram_username
    
    db.commit()
    db.refresh(player)
    return player

def set_player_category(db: DbSession, session_id: int, player_id: int = None, name: str = None, category: str = None, is_special: bool = None):
    from src.config import BALANCE_CATEGORY_KEY
    query = db.query(Player).filter(Player.session_id == session_id)
    if player_id:
        player = query.filter(Player.id == player_id).first()
    elif name:
        player = query.filter(func.lower(Player.name) == name.lower()).first()
    else:
        return None
        
    if not player:
        return None
        
    if is_special is not None:
        player.category = BALANCE_CATEGORY_KEY if is_special else "default"
    elif category is not None:
        player.category = category
        
    db.commit()
    db.refresh(player)
    return player

def set_player_goalkeeper(db: DbSession, session_id: int, player_id: int = None, name: str = None, is_goalkeeper: bool = True):
    query = db.query(Player).filter(Player.session_id == session_id)
    if player_id:
        player = query.filter(Player.id == player_id).first()
    elif name:
        player = query.filter(func.lower(Player.name) == name.lower()).first()
    else:
        return None
        
    if not player:
        return None
        
    player.is_goalkeeper = bool(is_goalkeeper)
    db.commit()
    db.refresh(player)
    return player

def cancel_presence(db: DbSession, session_id: int, name: str = None, telegram_id: int = None):
    player = get_player(db, session_id, name=name, telegram_id=telegram_id)
    if player:
        player.is_confirmed = False
        # Also remove from court/waiting if they cancel?
        player.has_arrived = False
        player.is_playing = False
        db.commit()
        return True
    return False

NEW_CHECKIN_AT_FRONT = True

def register_arrival(db: DbSession, session_id: int, name: str = None, telegram_id: int = None, telegram_username: str = None):
    player = get_player(db, session_id, name=name, telegram_id=telegram_id)
    if not player:
        player = confirm_presence(db, session_id, name, telegram_id, telegram_username)
    
    is_new = False
    if not player.has_arrived:
        is_new = True
        player.has_arrived = True
        
        # Calculate arrival order
        max_order = db.query(func.max(Player.arrival_order)).filter(Player.session_id == session_id).scalar()
        player.arrival_order = (max_order or 0) + 1
        
        # Determine queue placement if game is rolling
        active_players = db.query(Player).filter(
            Player.session_id == session_id, 
            Player.has_arrived == True,
            Player.id != player.id
        ).all()
        
        is_rolling = any(p.is_playing for p in active_players)
        
        if is_rolling:
            if NEW_CHECKIN_AT_FRONT:
                max_cycles = max([p.cycles_waiting for p in active_players] + [0])
                player.cycles_waiting = max_cycles
            else:
                player.cycles_waiting = 0
                
        db.commit()
        db.refresh(player)
    return player, is_new

def release_player(db: DbSession, session_id: int, name: str = None, telegram_id: int = None, telegram_username: str = None):
    return register_arrival(db, session_id, name=name, telegram_id=telegram_id, telegram_username=telegram_username)

def get_all_active_players(db: DbSession, session_id: int):
    return db.query(Player).filter(Player.session_id == session_id, Player.has_arrived == True).all()

def get_confirmed_players(db: DbSession, session_id: int):
    return db.query(Player).filter(Player.session_id == session_id, Player.is_confirmed == True).all()

def get_paying_players(db: DbSession, session_id: int):
    return db.query(Player).filter(
        Player.session_id == session_id, 
        Player.is_confirmed == True, 
        Player.is_paying == True
    ).all()

def leave_presence(db: DbSession, session_id: int, name: str = None, telegram_id: int = None):
    player = get_player(db, session_id, name=name, telegram_id=telegram_id)
    if not player or not player.has_arrived:
        return False, False
        
    was_playing = player.is_playing
    player.has_arrived = False
    player.is_playing = False
    player.is_confirmed = False
    
    db.commit()
    return True, was_playing

def set_paying_status(db: DbSession, session_id: int, name: str, is_paying: bool, telegram_id: int = None, telegram_username: str = None):
    player = get_player(db, session_id, name=name, telegram_id=telegram_id)
    
    if not player:
        # If the player does not exist in the session, create them so they can be marked as paying
        # But this means they'll be added to the session.
        # Ideally, paying members are already in the DB from previous sessions, but since we are tracking per session here...
        # Wait, if a player pays, they confirm presence? Let's just create them as NOT confirmed but is_paying=True if they don't exist.
        player = Player(
            session_id=session_id,
            name=name,
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            is_confirmed=False,
            is_paying=is_paying
        )
        db.add(player)
    else:
        player.is_paying = is_paying
        if telegram_id:
            player.telegram_id = telegram_id
        if telegram_username:
            player.telegram_username = telegram_username
            
    db.commit()
    db.refresh(player)
    return player

def restart_session(db: DbSession, session_id: int):
    old_session = db.query(Session).filter(Session.id == session_id).first()
    if not old_session:
        return None

    old_session.is_active = False

    public_hash = uuid.uuid4().hex[:8]
    admin_token = uuid.uuid4().hex[8:24]
    checkin_code = old_session.checkin_code or old_session.public_hash or public_hash

    new_session = Session(
        chat_id=old_session.chat_id,
        is_active=True,
        public_hash=public_hash,
        admin_token=admin_token,
        checkin_code=checkin_code,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_session)
    db.flush()

    paying_players = db.query(Player).filter(
        Player.session_id == old_session.id,
        Player.is_paying == True
    ).all()

    for old_p in paying_players:
        new_p = Player(
            session_id=new_session.id,
            name=old_p.name,
            telegram_id=old_p.telegram_id,
            telegram_username=old_p.telegram_username,
            category=old_p.category or "default",
            is_goalkeeper=bool(old_p.is_goalkeeper) if old_p.is_goalkeeper is not None else False,
            is_paying=True,
            is_confirmed=False,
            has_arrived=False,
            is_playing=False,
            matches_played=0,
            wins=0,
            draws=0,
            losses=0,
            cycles_in_court=0,
            cycles_waiting=0,
            arrival_order=0,
            draw_weight=0.0,
            initial_draw_order=9999,
            team_slot=0
        )
        db.add(new_p)

    db.commit()
    db.refresh(new_session)
    return new_session


def parse_whatsapp_entries(raw_text: str) -> list:
    """
    Parses a raw WhatsApp message text to extract player entries with metadata (name, is_goalkeeper, category).
    Handles formats like:
    1 - jhimy
    2 - jefin (goleiro)
    10- Alexandre (jovem)
    13-Alcides 🧤
    14 CARDOZO 🌱
    1. Nome
    1) Nome
    """
    from src.config import BALANCE_CATEGORY_KEY, BALANCE_CATEGORY_EMOJI
    if not raw_text or not raw_text.strip():
        return []

    lines = raw_text.splitlines()
    entries = []
    ignore_keywords = [
        "ranca", "pelada", "futebol", "coletes", "cores", "convidado", 
        "jogadores", "horário", "horario", "local", "quadra", "regras", "pix"
    ]

    current_is_gk = False

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        # Detect section header
        if re.search(r"(?i)\b(goleiros?|meta|guarda-redes)\b|🧤", line_clean) and not re.match(r"^\s*([0-9]{1,3})\s*[\-\.\)\:\–\—]", line_clean):
            current_is_gk = True
            continue
        elif any(kw in line_clean.lower() for kw in ["linha", "confirmada", "pagos que", "pendente"]) and not re.match(r"^\s*([0-9]{1,3})\s*[\-\.\)\:\–\—]", line_clean):
            current_is_gk = False
            continue
            
        match = re.match(r"^\s*([0-9]{1,3})\s*[\-\.\)\:\–\—]\s*(.+)$", line_clean)
        if not match:
            match = re.match(r"^\s*([0-9]{1,3})\s+([A-Za-zÀ-ÖØ-öø-ÿ].+)$", line_clean)
            
        if match:
            raw_candidate = match.group(2).strip()
            
            # Detect goalkeeper indicators: goleiro, gol, gk, glove emoji, or current_is_gk section
            is_gk = current_is_gk or bool(re.search(r"(?i)\b(goleiro|gol|gk)\b|🧤", raw_candidate))
            
            # Detect category indicators (jovem, seedling emoji, child emoji, or configured key)
            is_special_cat = bool(re.search(rf"(?i)\b({BALANCE_CATEGORY_KEY}|sub-?1[0-8]|jovem|menor)\b|{re.escape(BALANCE_CATEGORY_EMOJI)}|🌱|🧒", raw_candidate))
            
            candidate = re.sub(r"[^\w\s\.\-À-ÖØ-öø-ÿ]", "", raw_candidate).strip()
            candidate = re.sub(r"(?i)\b(goleiro|gol|gk|pago|pendente|convidado|mensalista|confirmado|jovem|menor)\b", "", candidate).strip()
            candidate = re.sub(r"[\(\)\[\]\-]+$", "", candidate).strip()
            
            if candidate and len(candidate) >= 2:
                candidate_lower = candidate.lower()
                if not any(candidate_lower.startswith(kw) for kw in ignore_keywords):
                    entries.append({
                        "name": candidate,
                        "is_goalkeeper": is_gk,
                        "category": BALANCE_CATEGORY_KEY if is_special_cat else "default"
                    })
                    
    return entries


def parse_whatsapp_presence_list(raw_text: str) -> list:
    return [e["name"] for e in parse_whatsapp_entries(raw_text)]


def import_whatsapp_presence_list(
    db: DbSession,
    session_id: int,
    raw_text: str,
    mark_arrived: bool = False,
    mark_paid: bool = False
) -> list:
    entries = parse_whatsapp_entries(raw_text)
    imported_players = []
    
    for entry in entries:
        name = entry["name"]
        is_gk = entry["is_goalkeeper"]
        cat = entry["category"]
        player = get_player(db, session_id, name=name)
        if not player:
            player = Player(
                session_id=session_id,
                name=name,
                is_confirmed=True,
                is_paying=mark_paid,
                is_goalkeeper=is_gk,
                category=cat
            )
            db.add(player)
            db.flush()
        else:
            player.is_confirmed = True
            if mark_paid:
                player.is_paying = True
            if is_gk:
                player.is_goalkeeper = True
            if cat and cat != "default":
                player.category = cat
                
        if mark_arrived:
            register_arrival(db, session_id, name=name)
            
        imported_players.append(player)
        
    db.commit()
    return imported_players


