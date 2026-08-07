import numpy as np
import json

from database import SessionLocal
from models import DocumentEmbedding


# =========================================================
# GLOBAL STATE
# =========================================================

_vectors = None      # shape: (N, D) numpy float32
_id_map = []         # list of DB ids matching each row


# =========================================================
# RESET
# =========================================================

def reset_faiss():
    global _vectors, _id_map
    _vectors = None
    _id_map = []
    print("🔄 Search index reset")


# =========================================================
# BUILD INDEX (pure numpy, no faiss)
# =========================================================

def build_faiss_index():
    global _vectors, _id_map

    db = SessionLocal()
    docs = db.query(DocumentEmbedding).all()
    db.close()

    if not docs:
        print("⚠️ No documents found for index")
        return

    vectors = []
    _id_map.clear()

    for doc in docs:
        try:
            emb = json.loads(doc.embedding)
            if emb:
                vectors.append(emb)
                _id_map.append(doc.id)
        except Exception as e:
            print("Embedding parse error:", e)
            continue

    if not vectors:
        print("⚠️ No valid embeddings found")
        return

    _vectors = np.array(vectors, dtype="float32")

    # L2-normalize for cosine similarity
    norms = np.linalg.norm(_vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1
    _vectors /= norms

    print(f"✅ Search index built with {len(_vectors)} vectors")


# =========================================================
# SEARCH (cosine similarity via dot product)
# =========================================================

def search_index(query_vector, top_k=8):
    global _vectors, _id_map

    if query_vector is None:
        return []

    if _vectors is None:
        build_faiss_index()

    if _vectors is None or len(_id_map) == 0:
        return []

    try:
        q = np.array(query_vector, dtype="float32")
        norm = np.linalg.norm(q)
        if norm > 0:
            q /= norm

        # Dot product → cosine similarity scores
        scores = _vectors.dot(q)

        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        seen = set()
        for idx in top_indices:
            if idx < len(_id_map):
                doc_id = _id_map[idx]
                if doc_id not in seen:
                    seen.add(doc_id)
                    results.append(doc_id)

        return results

    except Exception as e:
        print("Search error:", e)
        return []