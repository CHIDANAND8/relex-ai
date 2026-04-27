from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Message

router = APIRouter(prefix="/messages")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{conversation_id}")
def get_messages(conversation_id: int,
                 db: Session = Depends(get_db)):

    messages = db.query(Message)\
        .filter(Message.conversation_id == conversation_id)\
        .order_by(Message.id.asc())\
        .all()

    return messages
