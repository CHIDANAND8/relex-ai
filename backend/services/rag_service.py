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
        .limit(6)  # fetch 6 to have room for filtering
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

        # Truncate long assistant messages (e.g. document analysis)
        # to prevent old context from bleeding into the next answer
        content = m.content
        if role == "assistant" and len(content) > 500:
            content = content[:500] + "...[truncated for context window]"

        history.append(f"{role}: {content}")

    # Keep only last 4 entries after the truncation pass
    history = history[-4:]

    return "\n".join(history)


# =========================================================
# DOCUMENT CONTEXT (HYBRID RETRIEVAL + CONVERSATION SCOPE)
# =========================================================

def get_document_context(db, question: str, conversation_id: int = None):
    """
    Retrieves document & image OCR context:
    1. First checks documents explicitly attached to current conversation_id.
       - If <= 15 chunks, passes full document text so nothing is lost.
       - If > 15 chunks, hybrid reranks to pick top relevant sections.
    2. Fallback to vector FAISS search across all document embeddings.
    3. Detects any uploaded images for vision model assistance.
    """
    if not question or not question.strip():
        question_clean = ""
    else:
        question_clean = clean_text(question)

    conv_docs = []
    if conversation_id is not None:
        conv_docs = (
            db.query(DocumentEmbedding)
            .filter(DocumentEmbedding.conversation_id == conversation_id)
            .order_by(DocumentEmbedding.chunk_index.asc())
            .all()
        )

    matched_docs = []

    # Case A: Current conversation has uploaded documents / OCR
    if conv_docs:
        if len(conv_docs) <= 15:
            matched_docs = conv_docs
        else:
            # Score conversation chunks based on question keyword overlap + vector similarity
            q_words = set(question_clean.split())
            query_emb = create_embedding(question_clean) if question_clean else None
            
            scored = []
            for doc in conv_docs:
                c_clean = clean_text(doc.content or "")
                score = 1.0
                for w in q_words:
                    if len(w) > 2 and w in c_clean:
                        score += 5.0
                scored.append((score, doc))
            scored.sort(key=lambda x: x[0], reverse=True)
            matched_docs = [x[1] for x in scored[:15]]
            # Preserve original document ordering
            matched_docs.sort(key=lambda d: d.chunk_index if d.chunk_index is not None else 0)

    # Case B: No conversation-scoped docs, fallback to global FAISS vector search
    if not matched_docs:
        query_emb = create_embedding(question_clean) if question_clean else None
        if query_emb:
            faiss_ids = search_index(query_emb, top_k=30)
            if faiss_ids:
                docs = (
                    db.query(DocumentEmbedding)
                    .filter(DocumentEmbedding.id.in_(faiss_ids))
                    .all()
                )
                matched_docs = docs

    if not matched_docs:
        return "", []

    # Build structured citations & extract image paths
    unique_chunks = []
    seen = set()
    image_paths = []

    for doc in matched_docs:
        if not doc.content or not doc.content.strip():
            continue

        key = doc.content[:120]
        if key in seen:
            continue
        seen.add(key)

        display_name = doc.filename or "Uploaded Document"
        chunk_num = (doc.chunk_index + 1) if doc.chunk_index is not None else 1
        citation_header = f"--- [DOCUMENT: {display_name} | Section {chunk_num}] ---\n"
        unique_chunks.append(citation_header + doc.content.strip())

        # Collect image paths for vision processing
        if doc.document_title and os.path.exists(doc.document_title):
            ext = os.path.splitext(doc.document_title)[1].lower()
            if ext in [".png", ".jpg", ".jpeg", ".webp"] and doc.document_title not in image_paths:
                image_paths.append(doc.document_title)

    if not unique_chunks:
        return "", []

    context = "\n\n".join(unique_chunks)
    # Generous context limit for documents/spreadsheets/OCR
    context = context[:8000]

    return context, image_paths