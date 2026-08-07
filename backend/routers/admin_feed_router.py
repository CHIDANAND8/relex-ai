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

    db_feed = AdminFeed(**feed)
    db.add(db_feed)
    db.commit()

    # Trigger live WebSocket alert
    try:
        from services.notification_service import notification_manager
        import asyncio
        loop = asyncio.get_event_loop()
        event_payload = {
            "type": "FEED_CREATED",
            "message": f"New feed alert: {db_feed.title or 'Notification'}",
            "data": {
                "title": db_feed.title,
                "target": db_feed.target_user
            }
        }
        if loop.is_running():
            loop.create_task(notification_manager.broadcast(event_payload))
        else:
            loop.run_until_complete(notification_manager.broadcast(event_payload))
    except Exception as ws_err:
        print("Failed to broadcast feed notification:", ws_err)

    return {"msg": "Feed added"}


# =========================================================
# CREATE DOCUMENT FEED (OCR)
# =========================================================

@router.post("/feed-document")
async def create_document_feed(
    file: UploadFile = File(...),
    title: str = Form(...),
    content: str = Form(None),
    target_user: str = Form("ALL"),
    created_by: str = Form(None),
    db: Session = Depends(get_db)
):

    os.makedirs("uploads", exist_ok=True)
    unique_name = str(uuid.uuid4()) + "_" + file.filename
    file_path = os.path.join("uploads", unique_name)

    try:
        # Save file securely
        with open(file_path, "wb") as f:
            file_content = await file.read()
            f.write(file_content)

        # Offload intensive OCR/Parsing
        extracted_text = await asyncio.to_thread(parse_file, file_path)

        if not extracted_text or not extracted_text.strip():
            extracted_text = "[No readable text extracted from document]"

        target_clean = target_user.strip().lower()

        # Format context explicitly as a document attachment for the AI
        final_content = f"Attached Document [{file.filename}]:\n\n{extracted_text.strip()}"
        
        # If admin wrote a message body, prepend it
        if content and content.strip():
            final_content = f"{content.strip()}\n\n---\n\n{final_content}"

        # Hard cap to preserve RAG memory limits
        final_content = final_content[:80000]

        new_feed = AdminFeed(
            title=title.strip(),
            content=final_content,
            target_user=target_clean,
            created_by=created_by.strip().lower() if created_by else None,
            viewed_by="[]"
        )

        db.add(new_feed)
        db.commit()

        # Trigger live WebSocket alert
        try:
            from services.notification_service import notification_manager
            
            loop = asyncio.get_event_loop()
            event_payload = {
                "type": "FEED_CREATED",
                "message": f"New Document Parsed: {new_feed.title or file.filename}",
                "data": {
                    "title": new_feed.title,
                    "target": new_feed.target_user
                }
            }
            if loop.is_running():
                loop.create_task(notification_manager.broadcast(event_payload))
            else:
                loop.run_until_complete(notification_manager.broadcast(event_payload))
        except Exception as ws_err:
            print("Failed to broadcast document feed notification:", ws_err)

        return {"msg": "Document feed parsed and dispatched successfully"}

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


# =========================================================
# GET ALL FEEDS (ADMIN DASHBOARD)
# =========================================================

@router.get("/feeds")
def get_feeds(username: str = None, db: Session = Depends(get_db)):

    query = db.query(AdminFeed)
    if username:
        username_clean = username.strip().lower()
        query = query.filter(
            or_(
                func.lower(AdminFeed.created_by) == username_clean,
                AdminFeed.created_by == None
            )
        )

    feeds = query.order_by(
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
def clear_all_feeds(username: str = None, db: Session = Depends(get_db)):

    query = db.query(AdminFeed)
    if username:
        username_clean = username.strip().lower()
        query = query.filter(func.lower(AdminFeed.created_by) == username_clean)

    query.delete(synchronize_session=False)
    db.commit()

    return {"status": "all feeds cleared"}


# =========================================================
# GET REGISTERED USERS (ADMIN DASHBOARD)
# =========================================================

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):

    users = db.query(User).all()

    def safe_iso(dt):
        if not dt:
            return None
        if isinstance(dt, str):
            return dt
        try:
            return dt.isoformat()
        except Exception:
            return str(dt)

    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "created_at": safe_iso(u.created_at)
        }
        for u in users
    ]