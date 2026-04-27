from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from database import Base


# =========================================================
# USERS
# =========================================================

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    role = Column(String, default="user")

    # 🟢 Online indicator
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)

    # 🔔 Optional unread feeds counter
    unread_feeds = Column(Integer, default=0)


# =========================================================
# ADMIN FEEDS
# =========================================================

class AdminFeed(Base):

    __tablename__ = "admin_feeds"

    id = Column(Integer, primary_key=True)

    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    # username OR "ALL"
    target_user = Column(String, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # JSON string storing usernames who viewed
    viewed_by = Column(Text, default="[]")

    # optional flag
    is_active = Column(Boolean, default=True)


# =========================================================
# CONVERSATIONS
# =========================================================

class Conversation(Base):

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True)

    user_id = Column(Integer, index=True)

    title = Column(String, default="New Chat")

    created_at = Column(DateTime, default=datetime.utcnow)

    # 📌 pin conversation
    is_pinned = Column(Boolean, default=False)

    # unread counter
    unread_count = Column(Integer, default=0)

    # archive support
    is_archived = Column(Boolean, default=False)


# =========================================================
# MESSAGES (CHAT MEMORY)
# =========================================================

class Message(Base):

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)

    conversation_id = Column(Integer, index=True)

    role = Column(String)  # user / assistant
    content = Column(Text)

    parent_id = Column(Integer, nullable=True)

    branch_id = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # soft delete
    is_deleted = Column(Boolean, default=False)

    # star / bookmark
    is_starred = Column(Boolean, default=False)


# =========================================================
# DOCUMENT EMBEDDINGS (RAG STORAGE)
# =========================================================

class DocumentEmbedding(Base):

    __tablename__ = "document_embeddings"

    id = Column(Integer, primary_key=True)

    content = Column(Text)

    embedding = Column(Text)

    filename = Column(String, index=True)

    # pdf, docx, csv, image, audio etc
    file_type = Column(String)

    # 🔹 chunk order for better document reconstruction
    chunk_index = Column(Integer, default=0)

    # 🔹 optional document title
    document_title = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow) 