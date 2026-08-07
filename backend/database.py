import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# -----------------------------------------------------------
# DATABASE URL RESOLUTION
# Priority: DATABASE_URL env var (PostgreSQL on Neon/Railway)
#           → local SQLite fallback for development
# -----------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL:
    # Neon / Railway / Supabase use "postgres://" prefix — SQLAlchemy needs "postgresql://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    connect_args = {}
else:
    # Local development: use SQLite
    if os.path.isdir("/data"):
        DB_PATH = "/data/chat.db"     # Render persistent disk
    else:
        DB_PATH = "./chat.db"         # Local machine
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
