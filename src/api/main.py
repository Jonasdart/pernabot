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


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    sessions = db.query(models.Session).order_by(desc(models.Session.created_at)).all()
    return [
        {
            "id": s.id,
            "chat_id": s.chat_id,
            "created_at": s.created_at,
            "is_active": s.is_active
        }
        for s in sessions
    ]

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
