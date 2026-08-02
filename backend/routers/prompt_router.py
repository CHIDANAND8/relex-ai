from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import PromptTemplate
from pydantic import BaseModel

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PromptCreate(BaseModel):
    user_id: int
    title: str
    content: str

@router.post("/prompts")
def create_prompt(data: PromptCreate, db: Session = Depends(get_db)):
    prompt = PromptTemplate(
        user_id=data.user_id,
        title=data.title,
        content=data.content
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt

@router.get("/prompts/{user_id}")
def get_prompts(user_id: int, db: Session = Depends(get_db)):
    prompts = db.query(PromptTemplate).filter(PromptTemplate.user_id == user_id).order_by(PromptTemplate.created_at.desc()).all()
    return prompts

@router.delete("/prompts/{prompt_id}")
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    db.delete(prompt)
    db.commit()
    return {"message": "Prompt deleted matching id"}
