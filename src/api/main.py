import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any
import os

from src.database import get_db
import src.models as models

app = FastAPI(title="Pelada Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if not os.path.exists(frontend_path):
    os.makedirs(frontend_path)

@app.get("/")
def serve_index():
    return FileResponse(
        os.path.join(frontend_path, "index.html"),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    )

class NoCacheStaticFiles(StaticFiles):
    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

app.mount("/static", NoCacheStaticFiles(directory=frontend_path), name="static")


from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from src.config import (
    BALANCE_RULE_ENABLED, BALANCE_CATEGORY_KEY, 
    BALANCE_CATEGORY_LABEL, BALANCE_CATEGORY_EMOJI, BALANCE_MAX_PER_TEAM,
    GOALKEEPERS_PER_TEAM, GOALKEEPER_LABEL, GOALKEEPER_EMOJI
)
from src.services.session_service import get_session_by_hash, ensure_session_hashes, get_active_session_by_checkin_code
from src.services.player_service import (
    get_all_active_players, leave_presence, register_arrival, 
    set_paying_status, confirm_presence, cancel_presence, get_player, restart_session,
    import_whatsapp_presence_list, parse_whatsapp_presence_list, set_player_category,
    set_player_goalkeeper
)
from src.engine.explainer import get_team_captains
from src.engine.match import (
    draw_teams, rotate_players, pull_next_player, 
    sort_leaving_players, sort_entering_players, pick_entering_quartet,
    pick_entering_goalkeeper
)

class RotateRequest(BaseModel):
    winner: int  # 0, 1, 2

class PlayerActionRequest(BaseModel):
    player_id: int

class PaymentActionRequest(BaseModel):
    player_id: int
    is_paying: bool

class CategoryActionRequest(BaseModel):
    player_id: int
    is_special: Optional[bool] = None
    category: Optional[str] = None

class GoalkeeperActionRequest(BaseModel):
    player_id: int
    is_goalkeeper: bool

class PresenceActionRequest(BaseModel):
    is_confirmed: bool

class RenamePlayerRequest(BaseModel):
    name: str

class AddPlayerRequest(BaseModel):
    name: str
    is_paying: Optional[bool] = False
    is_confirmed: Optional[bool] = True
    do_checkin: Optional[bool] = False
    is_special: Optional[bool] = False
    category: Optional[str] = None
    is_goalkeeper: Optional[bool] = False

class ImportWhatsappRequest(BaseModel):
    text: str
    mark_arrived: Optional[bool] = False
    mark_paid: Optional[bool] = False

class SelfCheckinRequest(BaseModel):
    name: Optional[str] = None
    player_id: Optional[int] = None

class BatchPlayerActionRequest(BaseModel):
    player_ids: List[int]
    action: str

def format_iso_utc(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def build_match_response(session: models.Session, db: Session, token: Optional[str] = None) -> Dict[str, Any]:
    ensure_session_hashes(db, session)
    is_admin = bool(token and session.admin_token and token == session.admin_token)
    
    active_players = get_all_active_players(db, session.id)
    playing = [p for p in active_players if p.is_playing]
    waiting = [p for p in active_players if not p.is_playing]
    
    time_1 = [p for p in playing if p.team_slot == 1]
    time_2 = [p for p in playing if p.team_slot == 2]

    gk_1 = next((p for p in time_1 if getattr(p, "is_goalkeeper", False)), None)
    field_1 = [p for p in time_1 if not getattr(p, "is_goalkeeper", False)]
    sorted_t1 = sort_leaving_players(field_1)[::-1]

    gk_2 = next((p for p in time_2 if getattr(p, "is_goalkeeper", False)), None)
    field_2 = [p for p in time_2 if not getattr(p, "is_goalkeeper", False)]
    sorted_t2 = sort_leaving_players(field_2)[::-1]
    
    c1, c2 = get_team_captains(playing)
    t1_captain_name = c1.name if c1 else None
    t2_captain_name = c2.name if c2 else None
    
    t1_label = f"Time {t1_captain_name}" if t1_captain_name else "Time 1"
    t2_label = f"Time {t2_captain_name}" if t2_captain_name else "Time 2"
    
    field_waiting = [p for p in waiting if not getattr(p, "is_goalkeeper", False)]
    gk_waiting = [p for p in waiting if getattr(p, "is_goalkeeper", False)]

    sorted_waiting = sort_entering_players(field_waiting)
    sorted_gk_waiting = sort_entering_players(gk_waiting)

    next_team_players = pick_entering_quartet(waiting)
    next_team_ids = {p.id for p in next_team_players}
    has_special_in_next = any(getattr(p, "is_special_category", False) for p in next_team_players)
    
    next_goalkeeper = pick_entering_goalkeeper(waiting)
    
    # Calculate last event time for match timer
    last_log = db.query(models.MatchLog).filter(
        models.MatchLog.session_id == session.id
    ).order_by(desc(models.MatchLog.created_at)).first()
    
    last_event_dt = last_log.created_at if last_log and last_log.created_at else session.created_at
    last_event_iso = format_iso_utc(last_event_dt)
    last_event_type = last_log.event_type if last_log else None
    
    all_session_players = db.query(models.Player).filter(models.Player.session_id == session.id).all()
    
    def serialize_player(p):
        if not p:
            return None
        w = p.wins or 0
        d = p.draws or 0
        l = p.losses or 0
        matches = w + d + l if (w or d or l) else p.matches_played
        return {
            "id": p.id,
            "name": p.name,
            "telegram_id": p.telegram_id,
            "is_playing": p.is_playing,
            "team_slot": p.team_slot,
            "cycles_in_court": p.cycles_in_court,
            "cycles_waiting": p.cycles_waiting,
            "arrival_order": p.arrival_order,
            "matches_played": matches,
            "wins": w,
            "draws": d,
            "losses": l,
            "points": w * 3 + d * 1,
            "is_confirmed": p.is_confirmed,
            "has_arrived": p.has_arrived,
            "is_paying": p.is_paying,
            "category": getattr(p, "category", "default") or "default",
            "is_special_category": getattr(p, "is_special_category", False),
            "is_goalkeeper": bool(getattr(p, "is_goalkeeper", False))
        }

    def serialize_queue_player(p):
        data = serialize_player(p)
        is_in_next = p.id in next_team_ids
        data["is_in_next_team"] = is_in_next
        data["is_skipped_by_quota"] = bool(
            BALANCE_RULE_ENABLED and
            data["is_special_category"] and
            not is_in_next and
            has_special_in_next
        )
        return data
        
    return {
        "session_id": session.id,
        "public_hash": session.public_hash,
        "checkin_code": session.checkin_code or session.public_hash,
        "is_active": session.is_active,
        "is_admin": is_admin,
        "created_at": format_iso_utc(session.created_at),
        "is_playing": len(playing) > 0,
        "last_event_time": last_event_iso,
        "last_event_type": last_event_type,
        "teams": {
            "team_1": {
                "slot": 1,
                "captain_name": t1_captain_name,
                "label": t1_label,
                "goalkeeper": serialize_player(gk_1) if gk_1 else None,
                "players": [serialize_player(p) for p in sorted_t1]
            },
            "team_2": {
                "slot": 2,
                "captain_name": t2_captain_name,
                "label": t2_label,
                "goalkeeper": serialize_player(gk_2) if gk_2 else None,
                "players": [serialize_player(p) for p in sorted_t2]
            }
        },
        "next_team": [serialize_player(p) for p in next_team_players],
        "next_goalkeeper": serialize_player(next_goalkeeper) if next_goalkeeper else None,
        "queue": [serialize_queue_player(p) for p in sorted_waiting],
        "goalkeeper_queue": [serialize_player(p) for p in sorted_gk_waiting],
        "all_players": [serialize_player(p) for p in all_session_players],
        "balance_config": {
            "enabled": BALANCE_RULE_ENABLED,
            "key": BALANCE_CATEGORY_KEY,
            "label": BALANCE_CATEGORY_LABEL,
            "emoji": BALANCE_CATEGORY_EMOJI,
            "max_per_team": BALANCE_MAX_PER_TEAM
        },
        "goalkeeper_config": {
            "label": GOALKEEPER_LABEL,
            "emoji": GOALKEEPER_EMOJI,
            "per_team": GOALKEEPERS_PER_TEAM
        }
    }


def check_admin_key(key: Optional[str]):
    admin_key = os.getenv("ADMIN_KEY")
    if admin_key and admin_key.strip():
        if not key or key.strip() != admin_key.strip():
            raise HTTPException(status_code=401, detail="Acesso não autorizado: credencial de administrador necessária")

@app.get("/sessions")
def list_sessions(key: Optional[str] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    check_admin_key(key)
    sessions = db.query(models.Session).order_by(desc(models.Session.created_at)).all()
    for s in sessions:
        ensure_session_hashes(db, s)
    return [
        {
            "id": s.id,
            "chat_id": s.chat_id,
            "created_at": format_iso_utc(s.created_at),
            "is_active": s.is_active,
            "public_hash": s.public_hash,
            "admin_token": s.admin_token,
            "checkin_code": s.checkin_code or s.public_hash
        }
        for s in sessions
    ]

@app.get("/checkin/{checkin_code}")
def get_checkin_session_info(checkin_code: str, db: Session = Depends(get_db)):
    session = get_active_session_by_checkin_code(db, checkin_code)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada para este código de check-in.")
    
    all_players = db.query(models.Player).filter(models.Player.session_id == session.id).all()
    
    return {
        "session_id": session.id,
        "checkin_code": session.checkin_code or session.public_hash,
        "public_hash": session.public_hash,
        "is_active": session.is_active,
        "created_at": format_iso_utc(session.created_at),
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "is_confirmed": p.is_confirmed,
                "has_arrived": p.has_arrived,
                "is_paying": p.is_paying,
                "is_playing": p.is_playing,
                "arrival_order": p.arrival_order
            }
            for p in all_players
        ]
    }

@app.post("/checkin/{checkin_code}")
def self_checkin(checkin_code: str, req: SelfCheckinRequest, db: Session = Depends(get_db)):
    session = get_active_session_by_checkin_code(db, checkin_code)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada para este código de check-in.")
        
    if not session.is_active:
        raise HTTPException(status_code=400, detail="Esta pelada já foi finalizada. Aguarde o início da próxima sessão.")

    player = None
    if req.player_id:
        player = db.query(models.Player).filter(
            models.Player.session_id == session.id,
            models.Player.id == req.player_id
        ).first()

    name = req.name.strip() if req.name else None
    if not player and name:
        player = get_player(db, session.id, name=name)

    if not player:
        raise HTTPException(
            status_code=400, 
            detail=f"Jogador '{name or ''}' não encontrado nesta pelada. O auto check-in pelo site só é permitido para jogadores pré-cadastrados na lista."
        )

    # Bloquear auto check-in se pagamento estiver pendente
    # A liberação sem pagamento só pode ser feita pela moderação
    if not player.is_paying:
        raise HTTPException(
            status_code=400,
            detail=f"Olá {player.name}, seu pagamento consta como PENDENTE. O auto check-in só é liberado para jogadores com pagamento confirmado. Procure o administrador para pagar ou ser liberado."
        )

    already_arrived = player.has_arrived

    # Register arrival
    player, is_new = register_arrival(db, session.id, name=player.name, telegram_id=player.telegram_id)

    # Determine status in queue
    active_players = get_all_active_players(db, session.id)
    waiting = [p for p in active_players if not p.is_playing]
    sorted_waiting = sort_entering_players(waiting)
    
    queue_pos = None
    for idx, p in enumerate(sorted_waiting, 1):
        if p.id == player.id:
            queue_pos = idx
            break

    is_next_team = queue_pos is not None and queue_pos <= 4

    return {
        "success": True,
        "message": f"Check-in realizado com sucesso! {'Bem-vindo de volta!' if already_arrived else 'Bom jogo!'}",
        "already_arrived": already_arrived,
        "player": {
            "id": player.id,
            "name": player.name,
            "is_paying": player.is_paying,
            "has_arrived": player.has_arrived,
            "is_playing": player.is_playing,
            "arrival_order": player.arrival_order,
            "queue_position": queue_pos,
            "is_next_team": is_next_team
        },
        "public_hash": session.public_hash
    }

@app.get("/sessions/hash/{public_hash}")
def get_match_by_hash(public_hash: str, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/vencer")
def rotate_match(public_hash: str, req: RotateRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    active_players = get_all_active_players(db, session.id)
    
    # Capture captains before rotation for accurate winner labeling
    playing_before = [p for p in active_players if p.is_playing]
    c1, c2 = get_team_captains(playing_before)
    
    entering = rotate_players(active_players, winner=req.winner)
    
    match_log = models.MatchLog(session_id=session.id, event_type="rotate", created_at=datetime.now(timezone.utc))
    db.add(match_log)
    db.commit()
    
    res = build_match_response(session, db, token)
    
    if req.winner == 1:
        w_label = f"Time {c1.name}" if c1 else "Time 1"
    elif req.winner == 2:
        w_label = f"Time {c2.name}" if c2 else "Time 2"
    else:
        w_label = "Empate"
        
    res["entering_players"] = [{"id": p.id, "name": p.name} for p in entering] if entering else []
    res["last_result"] = {
        "winner": req.winner,
        "winner_label": w_label
    }
    return res

@app.post("/sessions/hash/{public_hash}/descer")
def player_step_down(public_hash: str, req: PlayerActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player or not player.is_playing:
        raise HTTPException(status_code=400, detail="Jogador não está em quadra")
        
    is_gk = bool(getattr(player, "is_goalkeeper", False))
    player.is_playing = False
    player.cycles_in_court = 0
    player.cycles_waiting = 0
    db.commit()
    
    active_players = get_all_active_players(db, session.id)
    pull_next_player(active_players, is_goalkeeper=is_gk)
    db.commit()
    
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/sair")
def player_leave(public_hash: str, req: PlayerActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    was_gk = bool(getattr(player, "is_goalkeeper", False))
    success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
    if was_playing:
        active_players = get_all_active_players(db, session.id)
        pull_next_player(active_players, is_goalkeeper=was_gk)
        db.commit()
        
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/checkout")
def player_checkout_hash(public_hash: str, req: PlayerActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    was_gk = bool(getattr(player, "is_goalkeeper", False))
    success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
    if was_playing:
        active_players = get_all_active_players(db, session.id)
        pull_next_player(active_players, is_goalkeeper=was_gk)
        db.commit()
        
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/checkin")
def player_checkin_hash(public_hash: str, req: PlayerActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    if not player.is_paying:
        raise HTTPException(status_code=400, detail="O jogador precisa estar com o pagamento confirmado para realizar o check-in.")
        
    register_arrival(db, session.id, name=player.name, telegram_id=player.telegram_id)
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/liberar")
def player_liberar_hash(public_hash: str, req: PlayerActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    register_arrival(db, session.id, name=player.name, telegram_id=player.telegram_id)
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/pagamento")
def player_payment_hash(public_hash: str, req: PaymentActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    set_paying_status(db, session.id, name=player.name, is_paying=req.is_paying, telegram_id=player.telegram_id)
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/categoria")
def player_category_hash(public_hash: str, req: CategoryActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    set_player_category(db, session.id, player_id=player.id, category=req.category, is_special=req.is_special)
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/goleiro")
def player_goalkeeper_hash(public_hash: str, req: GoalkeeperActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    player = db.query(models.Player).filter(models.Player.session_id == session.id, models.Player.id == req.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    set_player_goalkeeper(db, session.id, player_id=player.id, is_goalkeeper=req.is_goalkeeper)
    return build_match_response(session, db, token)

@app.post("/sessions/hash/{public_hash}/adicionar")
def add_player_hash(public_hash: str, req: AddPlayerRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    cat = BALANCE_CATEGORY_KEY if req.is_special else (req.category or "default")
    confirm_presence(db, session.id, name=req.name, category=cat, is_goalkeeper=req.is_goalkeeper)
    if req.is_paying:
        set_paying_status(db, session.id, name=req.name, is_paying=True)
    if req.do_checkin:
        register_arrival(db, session.id, name=req.name)

    return build_match_response(session, db, token)

@app.get("/sessions/{session_id}/players")
def list_players(session_id: int, key: Optional[str] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    check_admin_key(key)
        
    players = db.query(models.Player).filter(
        models.Player.session_id == session_id
    ).all()
    
    # Calculate average match duration
    logs = db.query(models.MatchLog).filter(models.MatchLog.session_id == session_id).order_by(models.MatchLog.created_at).all()
    
    # Default to 10 minutes (600 seconds) if we don't have enough data
    avg_duration_seconds = 600
    
    if len(logs) > 1:
        first_event = logs[0].created_at
        last_event = logs[-1].created_at
        total_seconds = (last_event - first_event).total_seconds()
        avg_duration_seconds = total_seconds / (len(logs) - 1)
        
    result = []
    for p in players:
        wins = p.wins or 0
        draws = p.draws or 0
        losses = p.losses or 0
        matches = wins + draws + losses if (wins or draws or losses) else p.matches_played
        estimated_time = (matches * avg_duration_seconds) / 60  # in minutes
        points = (wins * 3) + (draws * 1)
        
        result.append({
            "id": p.id,
            "name": p.name,
            "telegram_id": p.telegram_id,
            "is_confirmed": p.is_confirmed,
            "has_arrived": p.has_arrived,
            "is_paying": p.is_paying,
            "category": getattr(p, "category", "default") or "default",
            "is_special_category": getattr(p, "is_special_category", False),
            "is_goalkeeper": bool(getattr(p, "is_goalkeeper", False)),
            "matches_played": matches,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "points": points,
            "estimated_time_minutes": round(estimated_time, 2)
        })
        
    # Sort players by points (descending), then wins (descending), then matches_played
    result.sort(key=lambda x: (x["points"], x["wins"], x["matches_played"]), reverse=True)
    
    return result

@app.post("/sessions/{session_id}/players/{player_id}/checkin")
def session_player_checkin(session_id: int, player_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    if not player.is_paying:
        raise HTTPException(status_code=400, detail="O jogador precisa estar com o pagamento confirmado para realizar o check-in.")
    register_arrival(db, session_id, name=player.name, telegram_id=player.telegram_id)
    return {"message": f"Check-in realizado com sucesso para {player.name}"}

@app.post("/sessions/{session_id}/players/{player_id}/liberar")
def session_player_liberar(session_id: int, player_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    register_arrival(db, session_id, name=player.name, telegram_id=player.telegram_id)
    return {"message": f"Jogador {player.name} liberado com sucesso"}

@app.post("/sessions/{session_id}/players/{player_id}/checkout")
def session_player_checkout(session_id: int, player_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    was_gk = bool(getattr(player, "is_goalkeeper", False))
    success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
    if was_playing:
        active_players = get_all_active_players(db, session_id)
        pull_next_player(active_players, is_goalkeeper=was_gk)
        db.commit()
    return {"message": f"Checkout realizado com sucesso para {player.name}"}

@app.post("/sessions/{session_id}/players/{player_id}/pagamento")
def session_player_payment(session_id: int, player_id: int, req: PaymentActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    set_paying_status(db, session_id, name=player.name, is_paying=req.is_paying, telegram_id=player.telegram_id)
    return {"message": f"Status de pagamento atualizado para {player.name}"}

@app.post("/sessions/{session_id}/players/{player_id}/categoria")
def session_player_category(session_id: int, player_id: int, req: CategoryActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    set_player_category(db, session_id, player_id=player.id, category=req.category, is_special=req.is_special)
    return {
        "message": f"Categoria atualizada para {player.name}",
        "category": player.category,
        "is_special_category": player.is_special_category
    }

@app.post("/sessions/{session_id}/players/{player_id}/goleiro")
def session_player_goalkeeper(session_id: int, player_id: int, req: GoalkeeperActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    set_player_goalkeeper(db, session_id, player_id=player.id, is_goalkeeper=req.is_goalkeeper)
    return {
        "message": f"Status de goleiro atualizado para {player.name}",
        "is_goalkeeper": player.is_goalkeeper
    }

@app.post("/sessions/{session_id}/players/{player_id}/presenca")
def session_player_presence(session_id: int, player_id: int, req: PresenceActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    
    if req.is_confirmed:
        player.is_confirmed = True
        db.commit()
    else:
        cancel_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
        
    return {
        "message": f"Status de presença atualizado para {player.name}", 
        "is_confirmed": player.is_confirmed,
        "has_arrived": player.has_arrived
    }

@app.patch("/sessions/{session_id}/players/{player_id}/rename")
@app.put("/sessions/{session_id}/players/{player_id}/rename")
@app.post("/sessions/{session_id}/players/{player_id}/rename")
def rename_session_player(
    session_id: int, 
    player_id: int, 
    req: RenamePlayerRequest, 
    key: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
        
    new_name = req.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="O nome não pode ser vazio.")
        
    old_name = player.name
    player.name = new_name
    db.commit()
    db.refresh(player)
    
    return {
        "success": True,
        "message": f"Jogador '{old_name}' renomeado para '{new_name}'",
        "player_id": player.id,
        "new_name": player.name
    }

@app.delete("/sessions/{session_id}/players/{player_id}")
def delete_session_player(session_id: int, player_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    
    was_gk = bool(getattr(player, "is_goalkeeper", False))
    success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
    name = player.name
    db.delete(player)
    if was_playing:
        active_players = get_all_active_players(db, session_id)
        pull_next_player(active_players, is_goalkeeper=was_gk)
    db.commit()
    return {"message": f"Jogador {name} removido com sucesso"}

@app.post("/sessions/{session_id}/players")
def add_session_player(session_id: int, req: AddPlayerRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome do jogador é obrigatório")
        
    player = get_player(db, session_id, name=name)
    if not player:
        cat = BALANCE_CATEGORY_KEY if req.is_special else (req.category or "default")
        player = models.Player(
            session_id=session_id,
            name=name,
            is_confirmed=bool(req.is_confirmed or req.do_checkin),
            is_paying=bool(req.is_paying),
            category=cat,
            is_goalkeeper=bool(req.is_goalkeeper) if req.is_goalkeeper is not None else False
        )
        db.add(player)
        db.commit()
        db.refresh(player)
    else:
        if req.is_confirmed:
            player.is_confirmed = True
        if req.is_paying is not None:
            player.is_paying = req.is_paying
        if req.is_goalkeeper is not None:
            player.is_goalkeeper = bool(req.is_goalkeeper)
        if req.is_special is not None:
            player.category = BALANCE_CATEGORY_KEY if req.is_special else "default"
        elif req.category is not None:
            player.category = req.category
        db.commit()
        
    if req.do_checkin:
        if not player.is_paying:
            player.is_paying = True
            db.commit()
        register_arrival(db, session_id, name=player.name)
        
    return {"message": f"Jogador {player.name} adicionado/atualizado com sucesso", "player_id": player.id}

@app.post("/sessions/hash/{public_hash}/recomecar")
def restart_session_by_hash(public_hash: str, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado. Token admin necessário.")
    
    new_session = restart_session(db, session.id)
    return build_match_response(new_session, db, token=new_session.admin_token)

@app.post("/sessions/{session_id}/recomecar")
def restart_session_by_id(session_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    
    new_session = restart_session(db, session_id)
    return {
        "message": "Pelada recomeçada com sucesso",
        "new_session_id": new_session.id,
        "public_hash": new_session.public_hash,
        "admin_token": new_session.admin_token
    }

@app.post("/sessions/{session_id}/sortear")
def draw_session_teams(session_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)
    
    players = get_all_active_players(db, session_id)
    if len(players) < 8:
        raise HTTPException(
            status_code=400, 
            detail=f"O sorteio só pode ser realizado com no mínimo 8 jogadores com chegada confirmada (na quadra). Atualmente: {len(players)}"
        )
    
    draw_teams(players)
    
    match_log = models.MatchLog(session_id=session.id, event_type="draw", created_at=datetime.now(timezone.utc))
    db.add(match_log)
    db.commit()
    
    return {"message": "Sorteio realizado com sucesso!"}

@app.post("/sessions/hash/{public_hash}/sortear")
def draw_teams_by_hash(public_hash: str, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    players = get_all_active_players(db, session.id)
    if len(players) < 8:
        raise HTTPException(
            status_code=400, 
            detail=f"O sorteio só pode ser realizado com no mínimo 8 jogadores com chegada confirmada. Atualmente: {len(players)}"
        )
        
    draw_teams(players)
    
    match_log = models.MatchLog(session_id=session.id, event_type="draw", created_at=datetime.now(timezone.utc))
    db.add(match_log)
    db.commit()
    
    return build_match_response(session, db, token)


@app.post("/sessions/{session_id}/players/batch-action")
@app.post("/sessions/{session_id}/batch-action")
def session_batch_player_action(session_id: int, req: BatchPlayerActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    check_admin_key(key)

    if not req.player_ids:
        raise HTTPException(status_code=400, detail="Nenhum ID de jogador informado")

    players = db.query(models.Player).filter(
        models.Player.session_id == session_id,
        models.Player.id.in_(req.player_ids)
    ).all()

    if not players:
        raise HTTPException(status_code=404, detail="Nenhum jogador encontrado")

    action = req.action.lower()
    updated_count = 0
    field_needed = 0
    gk_needed = 0

    for player in players:
        if action == "pay":
            set_paying_status(db, session_id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
            updated_count += 1
        elif action == "unpay":
            set_paying_status(db, session_id, name=player.name, is_paying=False, telegram_id=player.telegram_id)
            updated_count += 1
        elif action in ("set_special", "set_jovem"):
            set_player_category(db, session_id, player_id=player.id, is_special=True)
            updated_count += 1
        elif action in ("unset_special", "unset_jovem"):
            set_player_category(db, session_id, player_id=player.id, is_special=False)
            updated_count += 1
        elif action in ("set_goalkeeper", "set_gk", "set_goleiro"):
            set_player_goalkeeper(db, session_id, player_id=player.id, is_goalkeeper=True)
            updated_count += 1
        elif action in ("unset_goalkeeper", "unset_gk", "unset_goleiro"):
            set_player_goalkeeper(db, session_id, player_id=player.id, is_goalkeeper=False)
            updated_count += 1
        elif action in ("checkin", "liberar"):
            if action == "checkin" and not player.is_paying:
                set_paying_status(db, session_id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
            register_arrival(db, session_id, name=player.name, telegram_id=player.telegram_id)
            updated_count += 1
        elif action == "checkout":
            was_gk = bool(getattr(player, "is_goalkeeper", False))
            success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                if was_gk:
                    gk_needed += 1
                else:
                    field_needed += 1
            updated_count += 1
        elif action in ("sair", "remove", "remover", "delete"):
            was_gk = bool(getattr(player, "is_goalkeeper", False))
            success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                if was_gk:
                    gk_needed += 1
                else:
                    field_needed += 1
            db.delete(player)
            updated_count += 1

    if field_needed > 0 or gk_needed > 0:
        active_players = get_all_active_players(db, session_id)
        for _ in range(gk_needed):
            pull_next_player(active_players, is_goalkeeper=True)
        for _ in range(field_needed):
            pull_next_player(active_players, is_goalkeeper=False)
    
    db.commit()

    return {"message": f"Ação '{action}' aplicada a {updated_count} jogador(es)", "updated_count": updated_count}


@app.post("/sessions/hash/{public_hash}/batch-action")
def match_batch_player_action_hash(public_hash: str, req: BatchPlayerActionRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")

    if not req.player_ids:
        raise HTTPException(status_code=400, detail="Nenhum ID de jogador informado")

    players = db.query(models.Player).filter(
        models.Player.session_id == session.id,
        models.Player.id.in_(req.player_ids)
    ).all()

    if not players:
        raise HTTPException(status_code=404, detail="Nenhum jogador encontrado")

    action = req.action.lower()
    field_needed = 0
    gk_needed = 0

    for player in players:
        if action == "pay":
            set_paying_status(db, session.id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
        elif action == "unpay":
            set_paying_status(db, session.id, name=player.name, is_paying=False, telegram_id=player.telegram_id)
        elif action in ("set_special", "set_jovem"):
            set_player_category(db, session.id, player_id=player.id, is_special=True)
        elif action in ("unset_special", "unset_jovem"):
            set_player_category(db, session.id, player_id=player.id, is_special=False)
        elif action in ("set_goalkeeper", "set_gk", "set_goleiro"):
            set_player_goalkeeper(db, session.id, player_id=player.id, is_goalkeeper=True)
        elif action in ("unset_goalkeeper", "unset_gk", "unset_goleiro"):
            set_player_goalkeeper(db, session.id, player_id=player.id, is_goalkeeper=False)
        elif action in ("checkin", "liberar"):
            if action == "checkin" and not player.is_paying:
                set_paying_status(db, session.id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
            register_arrival(db, session.id, name=player.name, telegram_id=player.telegram_id)
        elif action == "checkout":
            was_gk = bool(getattr(player, "is_goalkeeper", False))
            success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                if was_gk:
                    gk_needed += 1
                else:
                    field_needed += 1
        elif action in ("sair", "remove", "remover", "delete"):
            was_gk = bool(getattr(player, "is_goalkeeper", False))
            success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                if was_gk:
                    gk_needed += 1
                else:
                    field_needed += 1
            db.delete(player)

    if field_needed > 0 or gk_needed > 0:
        active_players = get_all_active_players(db, session.id)
        for _ in range(gk_needed):
            pull_next_player(active_players, is_goalkeeper=True)
        for _ in range(field_needed):
            pull_next_player(active_players, is_goalkeeper=False)
    
    db.commit()

    return build_match_response(session, db, token)


@app.post("/sessions/{session_id}/import-whatsapp")
def api_import_whatsapp_by_id(
    session_id: int, 
    req: ImportWhatsappRequest, 
    key: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
        
    imported = import_whatsapp_presence_list(db, session.id, req.text, req.mark_arrived, req.mark_paid)
    return {
        "success": True,
        "imported_count": len(imported),
        "player_names": [p.name for p in imported]
    }


@app.post("/sessions/hash/{public_hash}/import-whatsapp")
def api_import_whatsapp_by_hash(
    public_hash: str, 
    req: ImportWhatsappRequest, 
    token: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if token and session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado")
        
    imported = import_whatsapp_presence_list(db, session.id, req.text, req.mark_arrived, req.mark_paid)
    return {
        "success": True,
        "imported_count": len(imported),
        "player_names": [p.name for p in imported]
    }


# ====================================================================
# GESTÃO DA PELADA (GRUPO, ELENCO PERMANENTE E MENSALIDADES)
# ====================================================================

from src.services.group_service import (
    get_or_create_default_group,
    get_group,
    update_group,
    list_members,
    create_member,
    update_member,
    delete_member,
    toggle_monthly_payment,
    get_group_dashboard_summary,
    import_whatsapp_roster_members
)
from src.services.session_service import create_group_matchday

class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    frequency_type: Optional[str] = None
    frequency_config: Optional[str] = None
    monthly_fee: Optional[float] = None
    per_match_fee: Optional[float] = None
    due_day: Optional[int] = None
    pix_key: Optional[str] = None

class MemberCreateRequest(BaseModel):
    name: str
    member_type: Optional[str] = "mensalista"
    is_goalkeeper: Optional[bool] = False
    category: Optional[str] = "default"
    phone: Optional[str] = None

class MemberUpdateRequest(BaseModel):
    name: Optional[str] = None
    member_type: Optional[str] = None
    is_goalkeeper: Optional[bool] = None
    category: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class MonthlyPaymentToggleRequest(BaseModel):
    member_id: int
    year: int
    month: int
    is_paid: Optional[bool] = None
    amount: Optional[float] = None

class AddMembersToSessionRequest(BaseModel):
    member_ids: Optional[List[int]] = None
    all_mensalistas: Optional[bool] = False

@app.get("/groups/default")
def api_get_default_group(key: Optional[str] = None, year: Optional[int] = None, month: Optional[int] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    group = get_or_create_default_group(db)
    summary = get_group_dashboard_summary(db, group.id, year=year, month=month)
    return summary

@app.get("/groups/{group_id}")
def api_get_group_details(group_id: int, key: Optional[str] = None, year: Optional[int] = None, month: Optional[int] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    summary = get_group_dashboard_summary(db, group_id, year=year, month=month)
    if not summary:
        raise HTTPException(status_code=404, detail="Grupo/Pelada não encontrada")
    return summary

@app.put("/groups/{group_id}")
def api_update_group_settings(group_id: int, req: GroupUpdateRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    group = update_group(
        db,
        group_id=group_id,
        name=req.name,
        frequency_type=req.frequency_type,
        frequency_config=req.frequency_config,
        monthly_fee=req.monthly_fee,
        per_match_fee=req.per_match_fee,
        due_day=req.due_day,
        pix_key=req.pix_key
    )
    if not group:
        raise HTTPException(status_code=404, detail="Grupo/Pelada não encontrada")
    return {"message": "Configurações da pelada atualizadas com sucesso", "group_id": group.id}

@app.get("/groups/{group_id}/members")
def api_list_members(group_id: int, key: Optional[str] = None, year: Optional[int] = None, month: Optional[int] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    members = list_members(db, group_id=group_id, active_only=True, year=year, month=month)
    return members

@app.post("/groups/{group_id}/members")
def api_create_member(group_id: int, req: MemberCreateRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    member = create_member(
        db,
        group_id=group_id,
        name=req.name,
        member_type=req.member_type or "mensalista",
        is_goalkeeper=req.is_goalkeeper or False,
        category=req.category or "default",
        phone=req.phone
    )
    return {"message": "Membro adicionado com sucesso", "member_id": member.id}

@app.put("/groups/{group_id}/members/{member_id}")
def api_update_member(group_id: int, member_id: int, req: MemberUpdateRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    member = update_member(
        db,
        member_id=member_id,
        name=req.name,
        member_type=req.member_type,
        is_goalkeeper=req.is_goalkeeper,
        category=req.category,
        phone=req.phone,
        is_active=req.is_active
    )
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    return {"message": "Membro atualizado com sucesso", "member_id": member.id}

@app.delete("/groups/{group_id}/members/{member_id}")
def api_delete_member(group_id: int, member_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    success = delete_member(db, member_id)
    if not success:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    return {"message": "Membro desativado com sucesso"}

@app.post("/groups/{group_id}/payments/toggle")
def api_toggle_payment(group_id: int, req: MonthlyPaymentToggleRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    res = toggle_monthly_payment(
        db,
        group_id=group_id,
        member_id=req.member_id,
        year=req.year,
        month=req.month,
        is_paid=req.is_paid,
        amount=req.amount
    )
    return res

@app.post("/groups/{group_id}/matchdays/new")
def api_create_group_matchday(group_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    new_session = create_group_matchday(db, group_id=group_id)
    return {
        "message": "Novo Dia de Jogo aberto com sucesso!",
        "session_id": new_session.id,
        "public_hash": new_session.public_hash,
        "admin_token": new_session.admin_token,
        "checkin_code": new_session.checkin_code
    }

@app.post("/groups/{group_id}/matchdays/{session_id}/add-members")
def api_add_members_to_session(group_id: int, session_id: int, req: AddMembersToSessionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    target_members = []
    if req.all_mensalistas:
        target_members = db.query(models.Member).filter(
            models.Member.group_id == group_id,
            models.Member.member_type == "mensalista",
            models.Member.is_active == True
        ).all()
    elif req.member_ids:
        target_members = db.query(models.Member).filter(
            models.Member.group_id == group_id,
            models.Member.id.in_(req.member_ids),
            models.Member.is_active == True
        ).all()

    added_count = 0
    for m in target_members:
        confirm_presence(
            db,
            session_id=session.id,
            name=m.name,
            telegram_id=m.telegram_id,
            telegram_username=m.telegram_username,
            category=m.category,
            is_goalkeeper=m.is_goalkeeper
        )
        added_count += 1

    return {"message": f"{added_count} membros adicionados à lista de presença do dia.", "added_count": added_count}

class ImportRosterWhatsappRequest(BaseModel):
    text: str
    member_type: Optional[str] = "mensalista"

@app.post("/groups/{group_id}/import-whatsapp")
def api_import_whatsapp_roster(group_id: int, req: ImportRosterWhatsappRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    imported = import_whatsapp_roster_members(db, group_id, req.text, req.member_type or "mensalista")
    return {
        "success": True,
        "imported_count": len(imported),
        "members": [{"id": m.id, "name": m.name, "member_type": m.member_type} for m in imported]
    }







