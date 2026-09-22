import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///pernabot.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def run_auto_migrations():
    try:
        with engine.begin() as conn:
            # Check if sessions table exists
            table_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")).fetchone()
            if table_check:
                result = conn.execute(text("PRAGMA table_info(sessions)")).fetchall()
                column_names = [row[1] for row in result]
                if "checkin_code" not in column_names:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN checkin_code VARCHAR"))
                    print("Auto-migration: added 'checkin_code' column to sessions table.")
                
                # Ensure checkin_code is populated
                sessions = conn.execute(text("SELECT id, chat_id, public_hash, checkin_code FROM sessions ORDER BY created_at ASC")).fetchall()
                chat_checkin_map = {}
                for s_id, chat_id, public_hash, checkin_code in sessions:
                    if checkin_code:
                        chat_checkin_map[chat_id] = checkin_code
                    else:
                        code = chat_checkin_map.get(chat_id, public_hash or f"pelada-{s_id}")
                        chat_checkin_map[chat_id] = code
                        conn.execute(
                            text("UPDATE sessions SET checkin_code = :code WHERE id = :id"),
                            {"code": code, "id": s_id}
                        )

            # Check if players table exists and has category & is_goalkeeper
            players_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")).fetchone()
            if players_check:
                result = conn.execute(text("PRAGMA table_info(players)")).fetchall()
                col_names = [row[1] for row in result]
                if "category" not in col_names:
                    conn.execute(text("ALTER TABLE players ADD COLUMN category VARCHAR DEFAULT 'default'"))
                if "is_goalkeeper" not in col_names:
                    conn.execute(text("ALTER TABLE players ADD COLUMN is_goalkeeper BOOLEAN DEFAULT 0"))
    except Exception as e:
        print(f"Auto-migration notice: {e}")

run_auto_migrations()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

