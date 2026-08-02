import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import SharedChat, Conversation, Message

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/share/conversation/{conversation_id}")
def generate_share_link(conversation_id: int, db: Session = Depends(get_db)):
    # Check if a link already exists
    existing = db.query(SharedChat).filter(SharedChat.conversation_id == conversation_id).first()
    if existing:
        return {"uuid": existing.uuid}

    new_uuid = str(uuid.uuid4())
    shared_chat = SharedChat(
        uuid=new_uuid,
        conversation_id=conversation_id
    )
    db.add(shared_chat)
    db.commit()
    db.refresh(shared_chat)
    return {"uuid": shared_chat.uuid}

@router.get("/share/{share_uuid}")
def get_shared_chat(share_uuid: str, db: Session = Depends(get_db)):
    shared = db.query(SharedChat).filter(SharedChat.uuid == share_uuid).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared chat not found or expired")
    
    conversation = db.query(Conversation).filter(Conversation.id == shared.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = db.query(Message).filter(
        Message.conversation_id == shared.conversation_id,
        Message.is_deleted == False
    ).order_by(Message.created_at.asc()).all()

    return {
        "title": conversation.title,
        "created_at": conversation.created_at,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at
            }
            for m in messages
        ]
    }
