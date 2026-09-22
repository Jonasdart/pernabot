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
                if "group_id" not in column_names:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN group_id INTEGER"))
                    print("Auto-migration: added 'group_id' column to sessions table.")
                
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

            # Check if players table exists and has category, is_goalkeeper, member_id
            players_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")).fetchone()
            if players_check:
                result = conn.execute(text("PRAGMA table_info(players)")).fetchall()
                col_names = [row[1] for row in result]
                if "category" not in col_names:
                    conn.execute(text("ALTER TABLE players ADD COLUMN category VARCHAR DEFAULT 'default'"))
                if "is_goalkeeper" not in col_names:
                    conn.execute(text("ALTER TABLE players ADD COLUMN is_goalkeeper BOOLEAN DEFAULT 0"))
                if "member_id" not in col_names:
                    conn.execute(text("ALTER TABLE players ADD COLUMN member_id INTEGER"))
                    print("Auto-migration: added 'member_id' column to players table.")

            # Create groups table if not exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR NOT NULL DEFAULT 'Pelada Oficial',
                    chat_id INTEGER,
                    frequency_type VARCHAR NOT NULL DEFAULT 'weekly',
                    frequency_config VARCHAR NOT NULL DEFAULT '{"days": [1]}',
                    monthly_fee FLOAT NOT NULL DEFAULT 50.0,
                    per_match_fee FLOAT NOT NULL DEFAULT 15.0,
                    due_day INTEGER NOT NULL DEFAULT 10,
                    pix_key VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # Create members table if not exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                    name VARCHAR NOT NULL,
                    telegram_id INTEGER,
                    telegram_username VARCHAR,
                    phone VARCHAR,
                    member_type VARCHAR NOT NULL DEFAULT 'mensalista',
                    is_goalkeeper BOOLEAN DEFAULT 0,
                    category VARCHAR DEFAULT 'default',
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # Create monthly_payments table if not exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS monthly_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    status VARCHAR NOT NULL DEFAULT 'paid',
                    amount FLOAT NOT NULL DEFAULT 0.0,
                    paid_at TIMESTAMP,
                    notes VARCHAR
                )
            """))

            # Ensure default group exists
            default_group = conn.execute(text("SELECT id FROM groups LIMIT 1")).fetchone()
            if not default_group:
                # Find chat_id from existing sessions if any
                first_session = conn.execute(text("SELECT chat_id FROM sessions ORDER BY id ASC LIMIT 1")).fetchone()
                chat_id_val = first_session[0] if first_session else 0
                conn.execute(text("""
                    INSERT INTO groups (name, chat_id, frequency_type, frequency_config, monthly_fee, per_match_fee, due_day)
                    VALUES ('Pelada Oficial', :chat_id, 'weekly', '{"days": [1]}', 50.0, 15.0, 10)
                """), {"chat_id": chat_id_val})
                default_group = conn.execute(text("SELECT id FROM groups LIMIT 1")).fetchone()
                print(f"Auto-migration: created default group with ID {default_group[0]}.")

            if default_group:
                def_gid = default_group[0]
                # Associate sessions without group_id to default group
                conn.execute(text("UPDATE sessions SET group_id = :gid WHERE group_id IS NULL"), {"gid": def_gid})

                # Seed members from distinct players if members is empty
                members_count = conn.execute(text("SELECT COUNT(*) FROM members")).scalar()
                if members_count == 0 and players_check:
                    # Get distinct players by lower(trim(name))
                    rows = conn.execute(text("""
                        SELECT name, telegram_id, telegram_username, category, is_goalkeeper, MAX(is_paying) as ever_paid
                        FROM players
                        WHERE name IS NOT NULL AND TRIM(name) != ''
                        GROUP BY LOWER(TRIM(name))
                        ORDER BY id ASC
                    """)).fetchall()
                    for r_name, r_tid, r_tuser, r_cat, r_gk, r_paid in rows:
                        m_type = 'mensalista' if bool(r_paid) else 'avulso'
                        cursor = conn.execute(text("""
                            INSERT INTO members (group_id, name, telegram_id, telegram_username, member_type, is_goalkeeper, category, is_active)
                            VALUES (:gid, :name, :tid, :tuser, :mtype, :gk, :cat, 1)
                        """), {
                            "gid": def_gid,
                            "name": r_name.strip(),
                            "tid": r_tid,
                            "tuser": r_tuser,
                            "mtype": m_type,
                            "gk": bool(r_gk),
                            "cat": r_cat or "default"
                        })
                        new_mem_id = cursor.lastrowid
                        # Associate existing players with this member_id
                        conn.execute(text("""
                            UPDATE players SET member_id = :mid WHERE LOWER(TRIM(name)) = :pname
                        """), {"mid": new_mem_id, "pname": r_name.strip().lower()})
                    print(f"Auto-migration: seeded {len(rows)} members into default group.")

            # Ensure all existing member and player names in database are normalized to .title()
            existing_members = conn.execute(text("SELECT id, name FROM members WHERE name IS NOT NULL")).fetchall()
            for m_id, m_name in existing_members:
                normalized = m_name.strip().title()
                if m_name != normalized:
                    conn.execute(text("UPDATE members SET name = :n WHERE id = :id"), {"n": normalized, "id": m_id})

            existing_players = conn.execute(text("SELECT id, name FROM players WHERE name IS NOT NULL")).fetchall()
            for p_id, p_name in existing_players:
                normalized = p_name.strip().title()
                if p_name != normalized:
                    conn.execute(text("UPDATE players SET name = :n WHERE id = :id"), {"n": normalized, "id": p_id})

            # Ensure sessions without group_id are linked to the default group
            conn.execute(text("""
                UPDATE sessions
                SET group_id = (SELECT id FROM groups ORDER BY id ASC LIMIT 1)
                WHERE group_id IS NULL AND (SELECT COUNT(*) FROM groups) > 0
            """))

            # Ensure players without member_id are linked to members matching their name
            conn.execute(text("""
                UPDATE players
                SET member_id = (
                    SELECT m.id FROM members m
                    JOIN sessions s ON s.id = players.session_id
                    WHERE (m.group_id = s.group_id OR s.group_id IS NULL)
                      AND LOWER(TRIM(m.name)) = LOWER(TRIM(players.name))
                    LIMIT 1
                )
                WHERE member_id IS NULL
            """))
    except Exception as e:
        print(f"Auto-migration notice: {e}")

run_auto_migrations()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

