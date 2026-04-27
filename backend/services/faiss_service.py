import faiss
import numpy as np
import json

from database import SessionLocal
from models import DocumentEmbedding


# =========================================================
# GLOBAL STATE
# =========================================================

index = None
id_map = []


# =========================================================
# RESET FAISS
# =========================================================

def reset_faiss():
    global index, id_map
    index = None
    id_map.clear()
    print("🔄 FAISS reset")


# =========================================================
# NORMALIZE VECTORS (COSINE SIMILARITY)
# =========================================================

def normalize(vectors):
    faiss.normalize_L2(vectors)
    return vectors


# =========================================================
# BUILD FAISS INDEX
# =========================================================

def build_faiss_index():

    global index, id_map

    db = SessionLocal()

    docs = db.query(DocumentEmbedding).all()

    if not docs:
        print("⚠️ No documents found for FAISS")
        db.close()
        return

    vectors = []
    id_map.clear()

    for doc in docs:

        try:

            emb = json.loads(doc.embedding)

            if not emb:
                continue

            vectors.append(emb)
            id_map.append(doc.id)

        except Exception as e:

            print("Embedding parse error:", e)
            continue

    if not vectors:

        print("⚠️ No valid embeddings found")
        db.close()
        return

    vectors = np.array(vectors).astype("float32")

    # Normalize vectors for cosine similarity
    vectors = normalize(vectors)

    dimension = vectors.shape[1]

    # Create FAISS cosine similarity index
    index = faiss.IndexFlatIP(dimension)

    index.add(vectors)

    print(f"✅ FAISS index built with {len(vectors)} vectors")

    db.close()


# =========================================================
# SEARCH FAISS INDEX
# =========================================================

def search_index(query_vector, top_k=8):

    global index, id_map

    if query_vector is None:
        return []

    # Build index if missing
    if index is None:
        build_faiss_index()

    if index is None:
        return []

    try:

        q = np.array([query_vector]).astype("float32")

        q = normalize(q)

        scores, indices = index.search(q, top_k)

        results = []
        seen = set()

        for idx in indices[0]:

            if idx < len(id_map):

                doc_id = id_map[idx]

                # remove duplicates
                if doc_id not in seen:
                    seen.add(doc_id)
                    results.append(doc_id)

        return results

    except Exception as e:

        print("FAISS search error:", e)

        return []