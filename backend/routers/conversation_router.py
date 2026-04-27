from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import SessionLocal
from models import Conversation, Message
from datetime import datetime

router = APIRouter(prefix="/conversation")


# =========================================================
# DATABASE SESSION
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# SMART AUTO TITLE GENERATOR
# =========================================================

def generate_title_from_message(text: str) -> str:
    if not text:
        return "New Chat"

    clean = text.strip().split("\n")[0]

    if len(clean) > 50:
        return clean[:50] + "..."

    return clean


# =========================================================
# CREATE CONVERSATION
# =========================================================

@router.post("/create")
def create_conv(data: dict, db: Session = Depends(get_db)):

    if "user_id" not in data:
        raise HTTPException(status_code=400, detail="user_id required")

    conversation = Conversation(
        user_id=data["user_id"],
        title=data.get("title", "New Chat"),
        created_at=datetime.utcnow(),
        is_pinned=False,
        unread_count=0,
        is_archived=False
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return {"id": conversation.id}


# =========================================================
# LIST CONVERSATIONS (Pinned First + Active Only)
# =========================================================

@router.get("/{user_id}")
def list_conv(user_id: int, db: Session = Depends(get_db)):

    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id,
            Conversation.is_archived == False
        )
        .order_by(
            desc(Conversation.is_pinned),
            desc(Conversation.created_at)
        )
        .all()
    )

    return conversations


# =========================================================
# DELETE CONVERSATION (Hard Delete)
# =========================================================

@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: int,
                        db: Session = Depends(get_db)):

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404,
                            detail="Conversation not found")

    # Delete related messages first
    db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).delete()

    db.delete(conversation)
    db.commit()

    return {"status": "deleted"}


# =========================================================
# ARCHIVE CONVERSATION (Soft Delete)
# =========================================================

@router.post("/archive/{conversation_id}")
def archive_conversation(conversation_id: int,
                         db: Session = Depends(get_db)):

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404,
                            detail="Conversation not found")

    conversation.is_archived = True
    db.commit()

    return {"status": "archived"}


# =========================================================
# PIN / UNPIN CONVERSATION
# =========================================================

@router.post("/pin/{conversation_id}")
def toggle_pin(conversation_id: int,
               db: Session = Depends(get_db)):

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404,
                            detail="Conversation not found")

    conversation.is_pinned = not conversation.is_pinned
    db.commit()

    return {
        "status": "updated",
        "is_pinned": conversation.is_pinned
    }


# =========================================================
# RESET UNREAD COUNT (When user opens chat)
# =========================================================

@router.post("/reset-unread/{conversation_id}")
def reset_unread(conversation_id: int,
                 db: Session = Depends(get_db)):

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404,
                            detail="Conversation not found")

    conversation.unread_count = 0
    db.commit()

    return {"status": "reset"}


# =========================================================
# INCREMENT UNREAD (Called from chat_router)
# =========================================================

def increment_unread(db: Session, conversation_id: int):

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if conversation:
        conversation.unread_count += 1
        db.commit()


# =========================================================
# SEARCH CONVERSATIONS (Title Based)
# =========================================================

@router.get("/search/{user_id}")
def search_conversations(user_id: int,
                         query: str,
                         db: Session = Depends(get_db)):

    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id,
            Conversation.is_archived == False,
            Conversation.title.ilike(f"%{query}%")
        )
        .order_by(desc(Conversation.created_at))
        .all()
    )

    return conversations


# =========================================================
# AUTO TITLE UPDATE (Called from chat_router)
# =========================================================

def update_conversation_title_if_default(db: Session,
                                         conversation_id: int,
                                         first_message: str):

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        return

    # Only update if still default
    if conversation.title == "New Chat":
        conversation.title = generate_title_from_message(first_message)
        db.commit()
