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

from src.services.session_service import get_session_by_hash, ensure_session_hashes
from src.services.player_service import (
    get_all_active_players, leave_presence, register_arrival, 
    set_paying_status, confirm_presence, get_player, restart_session
)
from src.engine.explainer import get_team_captains
from src.engine.match import draw_teams, rotate_players, pull_next_player, sort_leaving_players, sort_entering_players

class RotateRequest(BaseModel):
    winner: int  # 0, 1, 2

class PlayerActionRequest(BaseModel):
    player_id: int

class PaymentActionRequest(BaseModel):
    player_id: int
    is_paying: bool

class AddPlayerRequest(BaseModel):
    name: str
    is_paying: Optional[bool] = False
    is_confirmed: Optional[bool] = True
    do_checkin: Optional[bool] = False

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
    
    c1, c2 = get_team_captains(playing)
    t1_captain_name = c1.name if c1 else None
    t2_captain_name = c2.name if c2 else None
    
    t1_label = f"Time {t1_captain_name}" if t1_captain_name else "Time 1"
    t2_label = f"Time {t2_captain_name}" if t2_captain_name else "Time 2"
    
    sorted_t1 = sort_leaving_players(time_1)[::-1]
    sorted_t2 = sort_leaving_players(time_2)[::-1]
    
    sorted_waiting = sort_entering_players(waiting)
    next_team_players = sorted_waiting[:4]
    
    # Calculate last event time for match timer
    last_log = db.query(models.MatchLog).filter(
        models.MatchLog.session_id == session.id
    ).order_by(desc(models.MatchLog.created_at)).first()
    
    last_event_dt = last_log.created_at if last_log and last_log.created_at else session.created_at
    last_event_iso = format_iso_utc(last_event_dt)
    last_event_type = last_log.event_type if last_log else None
    
    all_session_players = db.query(models.Player).filter(models.Player.session_id == session.id).all()
    
    def serialize_player(p):
        return {
            "id": p.id,
            "name": p.name,
            "telegram_id": p.telegram_id,
            "is_playing": p.is_playing,
            "team_slot": p.team_slot,
            "cycles_in_court": p.cycles_in_court,
            "cycles_waiting": p.cycles_waiting,
            "matches_played": p.matches_played,
            "wins": p.wins or 0,
            "draws": p.draws or 0,
            "losses": p.losses or 0,
            "points": (p.wins or 0) * 3 + (p.draws or 0) * 1,
            "is_confirmed": p.is_confirmed,
            "has_arrived": p.has_arrived,
            "is_paying": p.is_paying
        }
        
    return {
        "session_id": session.id,
        "public_hash": session.public_hash,
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
                "players": [serialize_player(p) for p in sorted_t1]
            },
            "team_2": {
                "slot": 2,
                "captain_name": t2_captain_name,
                "label": t2_label,
                "players": [serialize_player(p) for p in sorted_t2]
            }
        },
        "next_team": [serialize_player(p) for p in next_team_players],
        "queue": [serialize_player(p) for p in sorted_waiting],
        "all_players": [serialize_player(p) for p in all_session_players]
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
            "admin_token": s.admin_token
        }
        for s in sessions
    ]

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
        
    player.is_playing = False
    player.cycles_in_court = 0
    player.cycles_waiting = 0
    db.commit()
    
    active_players = get_all_active_players(db, session.id)
    pull_next_player(active_players)
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
        
    success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
    if was_playing:
        active_players = get_all_active_players(db, session.id)
        pull_next_player(active_players)
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
        
    success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
    if was_playing:
        active_players = get_all_active_players(db, session.id)
        pull_next_player(active_players)
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

@app.post("/sessions/hash/{public_hash}/adicionar")
def add_player_hash(public_hash: str, req: AddPlayerRequest, token: Optional[str] = None, db: Session = Depends(get_db)):
    session = get_session_by_hash(db, public_hash)
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    if not token or session.admin_token != token:
        raise HTTPException(status_code=403, detail="Acesso não autorizado: token de administrador inválido")
        
    confirm_presence(db, session.id, name=req.name)
    if req.is_paying:
        set_paying_status(db, session.id, name=req.name, is_paying=True)
    if req.do_checkin:
        register_arrival(db, session.id, name=req.name)

    return build_match_response(session, db, token)

@app.get("/sessions/{session_id}/players")
def list_players(session_id: int, key: Optional[str] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
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
        estimated_time = (p.matches_played * avg_duration_seconds) / 60  # in minutes
        wins = p.wins or 0
        draws = p.draws or 0
        losses = p.losses or 0
        points = (wins * 3) + (draws * 1)
        
        result.append({
            "id": p.id,
            "name": p.name,
            "telegram_id": p.telegram_id,
            "is_confirmed": p.is_confirmed,
            "has_arrived": p.has_arrived,
            "is_paying": p.is_paying,
            "matches_played": p.matches_played,
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
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    if not player.is_paying:
        raise HTTPException(status_code=400, detail="O jogador precisa estar com o pagamento confirmado para realizar o check-in.")
    register_arrival(db, session_id, name=player.name, telegram_id=player.telegram_id)
    return {"message": f"Check-in realizado com sucesso para {player.name}"}

@app.post("/sessions/{session_id}/players/{player_id}/liberar")
def session_player_liberar(session_id: int, player_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    register_arrival(db, session_id, name=player.name, telegram_id=player.telegram_id)
    return {"message": f"Jogador {player.name} liberado com sucesso"}

@app.post("/sessions/{session_id}/players/{player_id}/checkout")
def session_player_checkout(session_id: int, player_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
    if was_playing:
        active_players = get_all_active_players(db, session_id)
        pull_next_player(active_players)
        db.commit()
    return {"message": f"Checkout realizado com sucesso para {player.name}"}

@app.post("/sessions/{session_id}/players/{player_id}/pagamento")
def session_player_payment(session_id: int, player_id: int, req: PaymentActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    player = db.query(models.Player).filter(models.Player.session_id == session_id, models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    set_paying_status(db, session_id, name=player.name, is_paying=req.is_paying, telegram_id=player.telegram_id)
    return {"message": f"Status de pagamento atualizado para {player.name}"}

@app.post("/sessions/{session_id}/players")
def add_session_player(session_id: int, req: AddPlayerRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome do jogador é obrigatório")
        
    player = get_player(db, session_id, name=name)
    if not player:
        player = models.Player(
            session_id=session_id,
            name=name,
            is_confirmed=bool(req.is_confirmed or req.do_checkin),
            is_paying=bool(req.is_paying)
        )
        db.add(player)
        db.commit()
        db.refresh(player)
    else:
        if req.is_confirmed:
            player.is_confirmed = True
        if req.is_paying is not None:
            player.is_paying = req.is_paying
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
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    
    new_session = restart_session(db, session_id)
    return {
        "message": "Pelada recomeçada com sucesso",
        "new_session_id": new_session.id,
        "public_hash": new_session.public_hash,
        "admin_token": new_session.admin_token
    }

@app.post("/sessions/{session_id}/sortear")
def draw_session_teams(session_id: int, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")
    
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
def session_batch_player_action(session_id: int, req: BatchPlayerActionRequest, key: Optional[str] = None, db: Session = Depends(get_db)):
    check_admin_key(key)
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pelada não encontrada")

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
    needs_next_player = False

    for player in players:
        if action == "pay":
            set_paying_status(db, session_id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
            updated_count += 1
        elif action == "unpay":
            set_paying_status(db, session_id, name=player.name, is_paying=False, telegram_id=player.telegram_id)
            updated_count += 1
        elif action in ("checkin", "liberar"):
            if action == "checkin" and not player.is_paying:
                set_paying_status(db, session_id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
            register_arrival(db, session_id, name=player.name, telegram_id=player.telegram_id)
            updated_count += 1
        elif action == "checkout":
            success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                needs_next_player = True
            updated_count += 1
        elif action in ("sair", "remove"):
            success, was_playing = leave_presence(db, session_id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                needs_next_player = True
            db.delete(player)
            updated_count += 1

    if needs_next_player:
        active_players = get_all_active_players(db, session_id)
        pull_next_player(active_players)
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
    needs_next_player = False

    for player in players:
        if action == "pay":
            set_paying_status(db, session.id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
        elif action == "unpay":
            set_paying_status(db, session.id, name=player.name, is_paying=False, telegram_id=player.telegram_id)
        elif action in ("checkin", "liberar"):
            if action == "checkin" and not player.is_paying:
                set_paying_status(db, session.id, name=player.name, is_paying=True, telegram_id=player.telegram_id)
            register_arrival(db, session.id, name=player.name, telegram_id=player.telegram_id)
        elif action == "checkout":
            success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                needs_next_player = True
        elif action in ("sair", "remove"):
            success, was_playing = leave_presence(db, session.id, name=player.name, telegram_id=player.telegram_id)
            if was_playing:
                needs_next_player = True
            db.delete(player)

    if needs_next_player:
        active_players = get_all_active_players(db, session.id)
        pull_next_player(active_players)
        db.commit()

    return build_match_response(session, db, token)




