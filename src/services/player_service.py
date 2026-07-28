import uuid
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

def confirm_presence(db: DbSession, session_id: int, name: str, telegram_id: int = None, telegram_username: str = None):
    player = get_player(db, session_id, name=name, telegram_id=telegram_id)
    if not player:
        player = Player(
            session_id=session_id,
            name=name,
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            is_confirmed=True
        )
        db.add(player)
    else:
        player.is_confirmed = True
        if telegram_id:
            player.telegram_id = telegram_id
        if telegram_username:
            player.telegram_username = telegram_username
    
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

    new_session = Session(
        chat_id=old_session.chat_id,
        is_active=True,
        public_hash=public_hash,
        admin_token=admin_token,
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

