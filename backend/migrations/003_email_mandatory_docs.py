def up(conn):
    """Add mandatory_docs_present column to emails table."""
    cursor = conn.execute("PRAGMA table_info(emails)")
    cols = [row[1] for row in cursor.fetchall()]
    if "mandatory_docs_present" not in cols:
        conn.execute("ALTER TABLE emails ADD COLUMN mandatory_docs_present BOOLEAN")
