"""Lightweight numbered migration runner. No Alembic, pure sqlite3.

Usage:
    cd backend && python3 migrate.py          # CLI
    from migrate import run_migrations        # Called from main.py on startup
"""

import importlib
import re
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "johnson_ap.db"
MIGRATIONS_DIR = Path(__file__).parent / "migrations"

_MIGRATION_PATTERN = re.compile(r"^(\d{3})_.+\.py$")


def run_migrations(db_path: Path | None = None):
    """Apply all pending migrations. Safe to call repeatedly (idempotent)."""
    db_path = db_path or DB_PATH
    if not db_path.exists():
        print("[migrate] No DB found — will be created on first server start.")
        return

    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  name TEXT UNIQUE NOT NULL,"
        "  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ")"
    )
    conn.commit()

    applied = {row[0] for row in conn.execute("SELECT name FROM _migrations").fetchall()}

    # Discover migration files sorted by number
    files = []
    for f in MIGRATIONS_DIR.iterdir():
        m = _MIGRATION_PATTERN.match(f.name)
        if m and f.name != "__init__.py":
            files.append((int(m.group(1)), f.stem, f))
    files.sort()

    new_count = 0
    for _num, name, filepath in files:
        if name in applied:
            continue
        # Import and run
        spec = importlib.util.spec_from_file_location(name, filepath)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.up(conn)
        conn.execute("INSERT INTO _migrations (name) VALUES (?)", (name,))
        conn.commit()
        new_count += 1
        print(f"[migrate] Applied: {name}")

    already = len(applied)
    print(f"[migrate] Done. Applied {new_count} new, {already} already applied.")


if __name__ == "__main__":
    run_migrations()
