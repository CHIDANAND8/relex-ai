import os
from dotenv import load_dotenv
load_dotenv()
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routers import (
    message_router,
    auth_router,
    chat_router,
    admin_feed_router,
    upload_router,
    conversation_router,
    export_router,
    voice_router,
    prompt_router,
    share_router
)
from services.faiss_service import reset_faiss, build_faiss_index

reset_faiss()


app = FastAPI()



# =========================================================
# BUILD FAISS ON STARTUP (CORRECT WAY)
# =========================================================

@app.on_event("startup")
def startup_event():
       # 1️⃣ Create tables
    Base.metadata.create_all(bind=engine)
    
    # 🟢 Auto-migration: Ensure SQLite has conversation_id column in document_embeddings
    try:
        from sqlalchemy import text
        with engine.connect() as con:
            con.execute(text("ALTER TABLE document_embeddings ADD COLUMN conversation_id INTEGER"))
            con.commit()
            print("🧱 Database migration: Added conversation_id column to document_embeddings table")
    except Exception:
        # Silently pass if column already exists (SQL raises error)
        pass

    # 🟢 Auto-migration: Ensure SQLite has created_at column in users
    try:
        from sqlalchemy import text
        with engine.connect() as con:
            con.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NULL"))
            con.commit()
            print("🧱 Database migration: Added created_at column to users table")
    except Exception as e:
        print("🧱 Database migration debug: users table update skipped or already done:", e)

    # 🟢 Auto-migration: Ensure SQLite has created_by column in admin_feeds
    try:
        from sqlalchemy import text
        with engine.connect() as con:
            con.execute(text("ALTER TABLE admin_feeds ADD COLUMN created_by VARCHAR DEFAULT NULL"))
            con.commit()
            print("🧱 Database migration: Added created_by column to admin_feeds table")
    except Exception as e:
        print("🧱 Database migration debug: admin_feeds table update skipped or already done:", e)

    # 🟢 Auto-migration: Ensure SQLite has context_metadata column in messages
    try:
        from sqlalchemy import text
        with engine.connect() as con:
            con.execute(text("ALTER TABLE messages ADD COLUMN context_metadata TEXT DEFAULT NULL"))
            con.commit()
            print("🧱 Database migration: Added context_metadata column to messages table")
    except Exception as e:
        print("🧱 Database migration debug: messages table update skipped or already done:", e)

    print("🚀 Building FAISS index...")
      # 2️⃣ Then build FAISS
    build_faiss_index()
    print("✅ FAISS ready.")

# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-AI-Context"]
)

import os

# Use Render persistent disk for uploads if available
UPLOADS_DIR = "/data/uploads" if os.path.isdir("/data") else "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# =========================================================
# ROUTERS
# =========================================================

app.include_router(message_router.router)
app.include_router(auth_router.router)
app.include_router(chat_router.router)
app.include_router(admin_feed_router.router)
app.include_router(upload_router.router)
app.include_router(conversation_router.router)
app.include_router(export_router.router)
app.include_router(voice_router.router)
app.include_router(prompt_router.router)
app.include_router(share_router.router)

# =========================================================
# WEBSOCKET NOTIFICATIONS
# =========================================================
from fastapi import WebSocket, WebSocketDisconnect
from services.notification_service import notification_manager

@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    await notification_manager.connect(websocket)
    try:
        while True:
            # Receive text (can be used for ping/pong heartbeats)
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket)



# =========================================================
# TEST ROUTE
# =========================================================

@app.post("/backend")
def backend():
    return {"msg": "Backend running Successfully!"}

@app.get("/testdb")
def testdb():
    from database import SessionLocal
    from models import DocumentEmbedding
    db = SessionLocal()
    docs = db.query(DocumentEmbedding).all()
    res = []
    for d in docs:
        res.append({"filename": d.filename, "title": d.document_title, "content": d.content})
    db.close()
    return res
