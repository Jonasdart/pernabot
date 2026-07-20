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
    return FileResponse(os.path.join(frontend_path, "index.html"))

app.mount("/static", StaticFiles(directory=frontend_path), name="static")


from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from src.services.session_service import get_session_by_hash, ensure_session_hashes
from src.services.player_service import get_all_active_players, leave_presence
from src.engine.explainer import get_team_captains
from src.engine.match import rotate_players, pull_next_player, sort_leaving_players, sort_entering_players

class RotateRequest(BaseModel):
    winner: int  # 0, 1, 2

class PlayerActionRequest(BaseModel):
    player_id: int

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
            "points": (p.wins or 0) * 3 + (p.draws or 0) * 1
        }
        
    return {
        "session_id": session.id,
        "public_hash": session.public_hash,
        "is_active": session.is_active,
        "is_admin": is_admin,
        "created_at": format_iso_utc(session.created_at),
        "is_playing": len(playing) > 0,
        "last_event_time": last_event_iso,
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
        "queue": [serialize_player(p) for p in sorted_waiting]
    }


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
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
    entering = rotate_players(active_players, winner=req.winner)
    
    match_log = models.MatchLog(session_id=session.id, event_type="rotate", created_at=datetime.now(timezone.utc))
    db.add(match_log)
    db.commit()
    
    return build_match_response(session, db, token)

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

@app.get("/sessions/{session_id}/players")
def list_players(session_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
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

