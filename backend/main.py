import os
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
    conversation_router
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
    print("🚀 Building FAISS index...")
      # 2️⃣ Then build FAISS
    build_faiss_index()
    print("✅ FAISS ready.")

# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-AI-Context"]
)

# =========================================================
# STATIC FILES (SERVE UPLOADS)
# =========================================================
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# =========================================================
# ROUTERS
# =========================================================

app.include_router(message_router.router)
app.include_router(auth_router.router)
app.include_router(chat_router.router)
app.include_router(admin_feed_router.router)
app.include_router(upload_router.router)
app.include_router(conversation_router.router)


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
