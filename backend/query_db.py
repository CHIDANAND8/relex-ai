import json
from database import SessionLocal
from models import DocumentEmbedding

def main():
    db = SessionLocal()
    docs = db.query(DocumentEmbedding).all()
    print(f"Total documents: {len(docs)}")
    for doc in docs:
        print("-------")
        print(f"Filename: {doc.filename}")
        print(f"Title: {doc.document_title}")
        print(f"Content (first 100 chars): {doc.content[:100]}")
    db.close()

if __name__ == "__main__":
    main()
