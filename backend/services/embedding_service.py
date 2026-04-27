import requests
import json

OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
# We retain the old fallback for backwards compatibility if needed
OLLAMA_OLD_EMBED_URL = "http://localhost:11434/api/embeddings"
EMBED_MODEL = "nomic-embed-text"

def _prepare_text(text: str):
    if not text:
        return ""
    text = text.strip()
    if len(text) > 2000:
        text = text[:2000]
    return text

def create_embeddings_batch(texts: list):
    """Processes hundreds of chunks instantly using Ollama's efficient batch endpoint"""
    valid_texts = [_prepare_text(t) for t in texts if t and t.strip()]
    
    if not valid_texts:
        return []

    try:
        response = requests.post(
            OLLAMA_EMBED_URL,
            json={
                "model": EMBED_MODEL,
                "input": valid_texts,
                "keep_alive": "2h"
            },
            timeout=120
        )

        if response.status_code == 200:
            data = response.json()
            # The new /api/embed returns 'embeddings' list
            embeddings = data.get("embeddings")
            if embeddings:
                return embeddings
                
        # Fallback to the old api/embeddings if someone runs old Ollama versions
        # Very slow, but safe
        print("Falling back to single embeddings (Ollama /api/embed failed)")
        return [create_embedding(txt) for txt in valid_texts]

    except Exception as e:
        print("Batch embedding error:", e)
        return []

def create_embedding(text: str):
    """Legacy single text embedding wrapper"""
    text = _prepare_text(text)
    if not text: return None
    
    try:
        response = requests.post(
            OLLAMA_OLD_EMBED_URL,
            json={
                "model": EMBED_MODEL,
                "prompt": text,
                "keep_alive": "2h"
            },
            timeout=30
        )

        if response.status_code == 200:
            return response.json().get("embedding")
        return None

    except Exception as e:
        print("Embedding error:", e)
        return None