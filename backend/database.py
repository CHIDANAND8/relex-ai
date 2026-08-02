import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Use Render persistent disk in production (/data), fallback to local for development
if os.path.isdir("/data"):
    DB_PATH = "/data/chat.db"
else:
    DB_PATH = "./chat.db"

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
