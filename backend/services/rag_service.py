from sqlalchemy import func
from models import AdminFeed, Message, DocumentEmbedding
from services.embedding_service import create_embedding
from services.faiss_service import search_index

import re


# =========================================================
# CLEAN TEXT
# =========================================================

def clean_text(text: str):

    if not text:
        return ""

    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# =========================================================
# ADMIN FEED CONTEXT (UNCHANGED)
# =========================================================

def get_feed_context(db, username: str, question: str = ""):

    if not username:
        return ""

    username = username.strip().lower()
    question = clean_text(question)

    feeds = (
        db.query(AdminFeed)
        .filter(
            func.lower(func.trim(AdminFeed.target_user)).in_([username, "all"])
        )
        .order_by(AdminFeed.created_at.desc())
        .limit(20)
        .all()
    )

    if not feeds:
        return ""

    question_words = set(question.split())

    scored = []

    for feed in feeds:

        text = clean_text(feed.content)

        score = 1

        for word in question_words:
            if word in text:
                score += 2

        score += min(len(text) / 200, 1)

        scored.append((score, feed.content))

    scored.sort(key=lambda x: x[0], reverse=True)

    best = [f[1] for f in scored[:5]]

    labeled = [f"[AdminFeed for {username}] {text}" for text in best]

    return "\n".join(labeled)


# =========================================================
# MEMORY CONTEXT (UNCHANGED)
# =========================================================

def get_memory_context(db, conversation_id: int, branch_id=None):

    query = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.is_deleted == False
    )

    if branch_id is not None:
        query = query.filter(Message.branch_id == branch_id)

    msgs = (
        query
        .order_by(Message.created_at.desc())
        .limit(4)
        .all()
    )

    if not msgs:
        return ""

    msgs.reverse()

    history = []

    for m in msgs:

        if not m.content:
            continue

        role = "user" if m.role == "user" else "assistant"

        history.append(f"{role}: {m.content}")

    return "\n".join(history)


# =========================================================
# DOCUMENT CONTEXT (MULTI FILE FIX)
# =========================================================

def get_document_context(db, question: str):

    if not question or not question.strip():
        return "", []

    question_clean = clean_text(question)

    if len(question_clean) < 3:
        return "", []

    # ==========================================
    # CREATE QUERY EMBEDDING
    # ==========================================

    query_embedding = create_embedding(question_clean)

    if not query_embedding:
        return "", []

    # ==========================================
    # SEARCH FAISS
    # Increased window for multi-file retrieval
    # ==========================================

    faiss_ids = search_index(query_embedding, top_k=60)

    if not faiss_ids:
        print("FAISS returned no ids")
        return "", []

    docs = db.query(DocumentEmbedding).filter(
        DocumentEmbedding.id.in_(faiss_ids)
    ).all()

    if not docs:
        print("No documents found for FAISS ids")
        return "", []

    doc_map = {doc.id: doc for doc in docs}

    ordered_docs = []

    for i in faiss_ids:
        if i in doc_map:
            ordered_docs.append(doc_map[i])

    if not ordered_docs:
        ordered_docs = docs

    # ==========================================
    # HYBRID RERANKING
    # ==========================================

    question_words = set(question_clean.split())

    scored_docs = []

    for doc in ordered_docs:

        if not doc.content:
            continue

        content = clean_text(doc.content)
        filename_clean = clean_text(doc.filename if doc.filename else "")

        score = 0

        # Primary content keyword match
        for word in question_words:
            if word in content:
                score += 1
            if word in filename_clean:
                # Massive dynamic boost if the query targets the exact filename
                score += 5

        # Heuristic File-Type Intent Mapping
        if "pdf" in question_clean and doc.file_type == ".pdf":
            score += 20 # Explicit lock-on for PDF documents
            
        is_image_query = any(kw in question_clean for kw in ["image", "photo", "picture", "card"])
        if is_image_query and doc.file_type in [".png", ".jpg", ".jpeg"]:
            score += 5 # Slight boost for vision inputs
            
        # Massive Dynamic Keyword Targeting (Perfect Alignment)
        # Instead of hardcoding document types, massively boost ANY rare significant keyword.
        ignore_words = {"provide", "give", "show", "card", "details", "this", "image", "photo", "the", "please", "extract"}
        for word in question_words:
            if len(word) > 3 and word not in ignore_words:
                if word in content:
                    score += 150 # Absolute Override

        # Table isolation
        if "|" in doc.content or "," in doc.content:
            score += 1

        # Base vector confidence
        score += 0.5

        # Length normalization
        score += min(len(content) / 500, 1)

        scored_docs.append((score, doc.content, doc.document_title, doc.file_type))

    if not scored_docs:
        return "", []

    scored_docs.sort(key=lambda x: x[0], reverse=True)

    # ==========================================
    # MULTI FILE DIVERSITY FIX
    # ==========================================

    unique_chunks = []
    seen_chunks = set()
    ordered_files = []

    for score, text, fpath, ftype in scored_docs:

        key = text[:150]

        if key in seen_chunks:
            continue

        if fpath not in ordered_files:
            if len(ordered_files) < 4:
                ordered_files.append(fpath)

        seen_chunks.add(key)
        unique_chunks.append(text)

        if len(unique_chunks) >= 10:
            break

    if not unique_chunks:
        return "", []

    context = "\n\n".join(unique_chunks)
    context = context[:3500]

    # ONLY trigger visual context pipeline if the ultimate highest scoring vector target is an image!
    highest_score_file_type = scored_docs[0][3] if scored_docs else ""

    image_paths = []
    if highest_score_file_type in [".png", ".jpg", ".jpeg"]:
        image_paths = [
            p for p in ordered_files 
            if p and tuple(p.lower().rsplit(".", 1))[-1] in ["jpg", "jpeg", "png"]
        ]

    return context, image_paths