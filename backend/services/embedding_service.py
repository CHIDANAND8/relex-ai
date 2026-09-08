import os
import json
import hashlib
import numpy as np

# =========================================================
# EMBEDDING SERVICE
# Primary: Groq nomic-embed-text-v1.5 / OpenAI compatible embedding
# Local Fallback: Normalized 384-dim subword feature hash vector
# =========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_client = None
EMBEDDING_MODEL = "nomic-embed-text-v1.5"

if GROQ_API_KEY:
    try:
        from groq import Groq
        _client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        print("Groq client init error:", e)

def _prepare_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    return text[:2000]

def _generate_local_vector(text: str, dim: int = 384) -> list:
    """Deterministic, normalized subword feature hashing vector (fallback)."""
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    if not words:
        return vec.tolist()

    for word in words:
        # Word hash
        h_word = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16) % dim
        vec[h_word] += 1.0

        # Character tri-grams
        for i in range(len(word) - 2):
            tri = word[i:i+3]
            h_tri = int(hashlib.md5(tri.encode('utf-8')).hexdigest(), 16) % dim
            vec[h_tri] += 0.5

    # L2 normalize
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec.tolist()

def create_embedding(text: str) -> list:
    """Single text → embedding vector (Groq API or local semantic hash fallback)."""
    text = _prepare_text(text)
    if not text:
        return _generate_local_vector("empty", dim=384)

    if _client is not None:
        try:
            response = _client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            pass

    # Resilient local fallback
    return _generate_local_vector(text, dim=384)

def create_embeddings_batch(texts: list) -> list:
    """Batch embed multiple texts."""
    valid_texts = [_prepare_text(t) for t in texts if t and t.strip()]
    if not valid_texts:
        return []

    results = []
    for text in valid_texts:
        emb = create_embedding(text)
        if emb:
            results.append(emb)
    return results