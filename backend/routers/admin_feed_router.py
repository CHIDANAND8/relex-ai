from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from database import SessionLocal
from models import AdminFeed, User
from services.file_parser import parse_file

import json
import os
import uuid
import asyncio

router = APIRouter(prefix="/admin")


# =========================================================
# DB SESSION
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# CREATE FEED
# =========================================================

@router.post("/feed")
def create_feed(feed: dict, db: Session = Depends(get_db)):

    # Normalize target user
    if "target_user" in feed and isinstance(feed["target_user"], str):
        feed["target_user"] = feed["target_user"].strip().lower()

    # Initialize viewed_by
    if "viewed_by" not in feed:
        feed["viewed_by"] = "[]"

    db.add(AdminFeed(**feed))
    db.commit()

    return {"msg": "Feed added"}


# =========================================================
# CREATE DOCUMENT FEED (OCR)
# =========================================================

@router.post("/feed-document")
async def create_document_feed(
    file: UploadFile = File(...),
    title: str = Form(...),
    target_user: str = Form("ALL"),
    db: Session = Depends(get_db)
):

    os.makedirs("uploads", exist_ok=True)
    unique_name = str(uuid.uuid4()) + "_" + file.filename
    file_path = os.path.join("uploads", unique_name)

    try:
        # Save file securely
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Offload intensive OCR/Parsing
        extracted_text = await asyncio.to_thread(parse_file, file_path)

        if not extracted_text or not extracted_text.strip():
            extracted_text = "[No readable text extracted from document]"

        target_clean = target_user.strip().lower()

        # Format context explicitly as a document attachment for the AI
        final_content = f"Attached Document [{file.filename}]:\n\n{extracted_text.strip()}"
        
        # Hard cap to preserve RAG memory limits
        final_content = final_content[:80000]

        new_feed = AdminFeed(
            title=title.strip(),
            content=final_content,
            target_user=target_clean,
            viewed_by="[]"
        )

        db.add(new_feed)
        db.commit()

        return {"msg": "Document feed parsed and dispatched successfully"}

    except Exception as e:
        db.rollback()
        print("Admin Doc Feed Error:", e)
        raise HTTPException(status_code=500, detail="Failed to process document")


# =========================================================
# GET ALL FEEDS (ADMIN DASHBOARD)
# =========================================================

@router.get("/feeds")
def get_feeds(db: Session = Depends(get_db)):

    feeds = db.query(AdminFeed).order_by(
        AdminFeed.created_at.desc()
    ).all()

    return feeds


# =========================================================
# GET USER FEEDS (SIDEBAR)
# =========================================================

@router.get("/user-feeds/{username}")
def get_user_feeds(username: str, db: Session = Depends(get_db)):

    username = username.strip().lower()

    feeds = db.query(AdminFeed).filter(
        or_(
            func.lower(AdminFeed.target_user) == username,
            func.lower(AdminFeed.target_user) == "all"
        )
    ).order_by(AdminFeed.created_at.desc()).all()

    return feeds


# =========================================================
# MARK FEED AS VIEWED
# =========================================================

@router.post("/mark-feed-viewed/{feed_id}/{username}")
def mark_feed_viewed(feed_id: int, username: str, db: Session = Depends(get_db)):

    feed = db.query(AdminFeed).filter(
        AdminFeed.id == feed_id
    ).first()

    if not feed:
        return {"error": "Feed not found"}

    viewed = json.loads(feed.viewed_by or "[]")

    username = username.strip().lower()

    if username not in viewed:
        viewed.append(username)
        feed.viewed_by = json.dumps(viewed)
        db.commit()

    return {"status": "ok"}


# =========================================================
# DELETE SINGLE FEED
# =========================================================

@router.delete("/feed/{feed_id}")
def delete_feed(feed_id: int, db: Session = Depends(get_db)):

    feed = db.query(AdminFeed).filter(
        AdminFeed.id == feed_id
    ).first()

    if not feed:
        return {"error": "Feed not found"}

    db.delete(feed)
    db.commit()

    return {"status": "deleted"}


# =========================================================
# CLEAR ALL FEEDS
# =========================================================

@router.delete("/feeds/clear")
def clear_all_feeds(db: Session = Depends(get_db)):

    db.query(AdminFeed).delete()
    db.commit()

    return {"status": "all feeds cleared"}


# =========================================================
# GET REGISTERED USERS (ADMIN DASHBOARD)
# =========================================================

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):

    users = db.query(User).all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role
        }
        for u in users
    ]