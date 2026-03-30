"""Database engine + session factory. SQLite dev, PostgreSQL prod via DATABASE_URL env."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///johnson_ap.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency yielding a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables from models."""
    from models import Base as _  # noqa: F401 — ensure models registered
    Base.metadata.create_all(bind=engine)
