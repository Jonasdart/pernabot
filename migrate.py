from sqlalchemy import create_engine, text
import os

db_url = os.getenv("DATABASE_URL", "sqlite:///pernabot.db")
print(f"Connecting to database: {db_url}")
engine = create_engine(db_url)

with engine.begin() as conn:
    # Check sessions table columns
    result = conn.execute(text("PRAGMA table_info(sessions)")).fetchall()
    column_names = [row[1] for row in result]
    print(f"Current columns in sessions: {column_names}")
    
    if "checkin_code" not in column_names:
        conn.execute(text("ALTER TABLE sessions ADD COLUMN checkin_code VARCHAR"))
        print("Added column 'checkin_code' to sessions")
    else:
        print("Column 'checkin_code' already exists in sessions")

    # Populate checkin_code for existing sessions grouped by chat_id
    sessions = conn.execute(text("SELECT id, chat_id, public_hash, checkin_code FROM sessions ORDER BY created_at ASC")).fetchall()
    chat_checkin_map = {}
    
    for s_id, chat_id, public_hash, checkin_code in sessions:
        if checkin_code:
            chat_checkin_map[chat_id] = checkin_code
        else:
            if chat_id in chat_checkin_map:
                code = chat_checkin_map[chat_id]
            else:
                code = public_hash if public_hash else f"pelada-{s_id}"
                chat_checkin_map[chat_id] = code
                
            conn.execute(
                text("UPDATE sessions SET checkin_code = :code WHERE id = :id"),
                {"code": code, "id": s_id}
            )
    # Check players table columns
    player_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(players)")).fetchall()]
    if "category" not in player_columns:
        conn.execute(text("ALTER TABLE players ADD COLUMN category VARCHAR DEFAULT 'default'"))
        print("Added column 'category' to players")
    else:
        print("Column 'category' already exists in players")

    if "is_goalkeeper" not in player_columns:
        conn.execute(text("ALTER TABLE players ADD COLUMN is_goalkeeper BOOLEAN DEFAULT 0"))
        print("Added column 'is_goalkeeper' to players")
    else:
        print("Column 'is_goalkeeper' already exists in players")

print("Migration completed successfully.")
