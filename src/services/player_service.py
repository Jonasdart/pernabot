from sqlalchemy.orm import Session as DbSession
from sqlalchemy import func
from src.models.player import Player

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

def get_all_active_players(db: DbSession, session_id: int):
    return db.query(Player).filter(Player.session_id == session_id, Player.has_arrived == True).all()

def get_confirmed_players(db: DbSession, session_id: int):
    return db.query(Player).filter(Player.session_id == session_id, Player.is_confirmed == True).all()

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
