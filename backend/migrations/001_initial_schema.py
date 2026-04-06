def up(conn):
    """Initial schema — tables created by SQLAlchemy create_all().
    This migration exists for tracking purposes. No-op on existing DBs."""
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if cursor.fetchone():
        return  # Already initialized by create_all()
    # Fresh DB without create_all() — no-op, create_all() in db.py handles it
