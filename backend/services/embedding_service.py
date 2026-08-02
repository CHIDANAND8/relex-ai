from sentence_transformers import SentenceTransformer
import numpy as np

# Load small local embedding model (downloads on first run)
# This does NOT rely on Ollama, meaning it works perfectly on Render/Vercel
try:
    print("Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print("Failed to load SentenceTransformer:", e)
    model = None

def _prepare_text(text: str):
    if not text:
        return ""
    text = text.strip()
    if len(text) > 2000:
        text = text[:2000]
    return text

def create_embeddings_batch(texts: list):
    """Processes hundreds of chunks instantly using local sentence-transformers"""
    valid_texts = [_prepare_text(t) for t in texts if t and t.strip()]
    
    if not valid_texts or model is None:
        return []

    try:
        embeddings = model.encode(valid_texts)
        # Convert numpy arrays to lists
        return [emb.tolist() for emb in embeddings]
    except Exception as e:
        print("Batch embedding error:", e)
        return []

def create_embedding(text: str):
    """Single text embedding wrapper"""
    text = _prepare_text(text)
    if not text or model is None: return None
    
    try:
        embedding = model.encode(text)
        return embedding.tolist()
    except Exception as e:
        print("Embedding error:", e)
        return None