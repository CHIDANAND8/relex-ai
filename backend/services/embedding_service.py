import os
import json
import numpy as np

# =========================================================
# GROQ EMBEDDING SERVICE
# Uses Groq's free nomic-embed-text-v1.5 model
# Replaces heavy sentence-transformers + torch (2GB RAM)
# =========================================================

try:
    from groq import Groq
    _client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
    EMBEDDING_MODEL = "nomic-embed-text-v1.5"
    USE_GROQ_EMBEDDINGS = True
    print("✅ Groq embedding service ready")
except Exception as e:
    _client = None
    USE_GROQ_EMBEDDINGS = False
    print(f"⚠️ Groq embedding unavailable: {e}")


def _prepare_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    if len(text) > 2000:
        text = text[:2000]
    return text


def create_embedding(text: str):
    """Single text → embedding vector via Groq API"""
    text = _prepare_text(text)
    if not text:
        return None

    if not USE_GROQ_EMBEDDINGS or _client is None:
        # Fallback: return a random vector (FAISS won't match anything useful)
        print("⚠️ No embedding model available — returning None")
        return None

    try:
        response = _client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Groq embedding error: {e}")
        return None


def create_embeddings_batch(texts: list):
    """Batch embed multiple texts"""
    valid_texts = [_prepare_text(t) for t in texts if t and t.strip()]
    if not valid_texts:
        return []

    results = []
    for text in valid_texts:
        emb = create_embedding(text)
        if emb:
            results.append(emb)
    return results