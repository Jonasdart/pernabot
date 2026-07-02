from sqlalchemy import create_engine, text
try:
    engine = create_engine('sqlite:///src/database.db')
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE players ADD COLUMN team_slot INTEGER DEFAULT 0"))
    print("Migration successful")
except Exception as e:
    print("Error:", e)
