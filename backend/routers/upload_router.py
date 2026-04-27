from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import DocumentEmbedding

from services.embedding_service import create_embedding, create_embeddings_batch
from services.faiss_service import build_faiss_index
from services.audio_service import transcribe_audio
from services.video_service import process_video

from pypdf import PdfReader
from docx import Document

import pandas as pd
import fitz  # PyMuPDF

from services.ocr_service import process_image_ocr, process_pdf_page_ocr

import json
import os
import re
import uuid
import asyncio

router = APIRouter()


# =========================================================
# DATABASE
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# CLEAN TEXT
# =========================================================

def clean_text(text):

    if not text:
        return ""

    text = re.sub(r"\s+", " ", text)

    return text.strip()


# =========================================================
# CHUNK TEXT
# =========================================================

def chunk_text(text, chunk_size=700, overlap=150):

    chunks = []

    start = 0
    length = len(text)

    while start < length:

        end = min(start + chunk_size, length)

        chunk = text[start:end]

        last_period = chunk.rfind(".")
        if last_period > 200:
            chunk = chunk[:last_period + 1]

        if chunk.strip():
            chunks.append(chunk)

        start += chunk_size - overlap

        # prevent excessive chunk creation
        if len(chunks) >= 120:
            break

    return chunks


# =========================================================
# FILE PARSER
# =========================================================

def extract_text(file_path):

    ext = os.path.splitext(file_path)[1].lower()

    full_text = ""

    try:

        # ---------------- PDF ----------------
        if ext == ".pdf":

            reader = PdfReader(file_path)
            
            # Open with fitz as a backup for scanned pages
            pdf_document = fitz.open(file_path)

            for i, page in enumerate(reader.pages):

                text = page.extract_text()

                if text and text.strip():
                    full_text += text + "\n"
                else:
                    # Fallback to OCR for this page if no text was found (scanned PDF)
                    if i < len(pdf_document):
                        fitz_page = pdf_document.load_page(i)
                        ocr_text = process_pdf_page_ocr(fitz_page)
                        if ocr_text:
                            full_text += ocr_text + "\n"

                if i >= 30:
                    break
                    
            pdf_document.close()


        # ---------------- DOCX ----------------
        elif ext == ".docx":

            doc = Document(file_path)

            for p in doc.paragraphs:

                if p.text:
                    full_text += p.text + "\n"


        # ---------------- TXT ----------------
        elif ext == ".txt":

            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                full_text = f.read()


        # ---------------- CSV ----------------
        elif ext == ".csv":

            df = pd.read_csv(file_path)

            df = df.head(300)

            full_text = df.to_string(index=False)


        # ---------------- EXCEL ----------------
        elif ext in [".xlsx", ".xls"]:

            df = pd.read_excel(file_path)

            df = df.head(300)

            full_text = df.to_string(index=False)


        # ---------------- JSON ----------------
        elif ext == ".json":

            with open(file_path) as f:
                data = json.load(f)

            full_text = json.dumps(data, indent=2)


        # ---------------- IMAGE OCR ----------------
        elif ext in [".png", ".jpg", ".jpeg"]:

            full_text = process_image_ocr(file_path)


        # ---------------- AUDIO ----------------
        elif ext in [".mp3", ".wav", ".m4a"]:

            full_text = transcribe_audio(file_path)


        # ---------------- VIDEO ----------------
        elif ext in [".mp4", ".mov", ".avi"]:

            full_text = process_video(file_path)


        else:
            print("Unsupported file type:", ext)

    except Exception as e:

        print("File parse error:", e)

    return full_text


# =========================================================
# UPLOAD ROUTE
# =========================================================

@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    os.makedirs("uploads", exist_ok=True)

    # prevent duplicate filename conflicts
    unique_name = str(uuid.uuid4()) + "_" + file.filename
    file_path = os.path.join("uploads", unique_name)

    # Save file
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    print("File uploaded:", unique_name)

    # Extract text (run in thread to not block FastAPI)
    full_text = await asyncio.to_thread(extract_text, file_path)

    full_text = clean_text(full_text)

    print("Extracted text length:", len(full_text))

    if not full_text:

        return {"error": "No readable text found"}

    # limit large docs
    full_text = full_text[:80000]

    chunks = chunk_text(full_text)

    print("Chunks created:", len(chunks))

    # delete previous embeddings
    db.query(DocumentEmbedding).filter(
        DocumentEmbedding.filename == file.filename
    ).delete()

    db.commit()

    embedded_count = 0

    ext = os.path.splitext(file.filename)[1].lower()

    try:

        valid_chunks = [c for c in chunks if len(c) >= 120]
        
        if valid_chunks:
            # Huge speedup: Get all embeddings in ONE network call instead of hundreds!
            embeddings = create_embeddings_batch(valid_chunks)

            for chunk, emb in zip(valid_chunks, embeddings):
                if not emb:
                    continue

                doc = DocumentEmbedding(
                    content=chunk,
                    embedding=json.dumps(emb),
                    filename=file.filename,
                    file_type=ext,
                    document_title=file_path
                )

                db.add(doc)
                embedded_count += 1

            db.commit()

    except Exception as e:

        db.rollback()
        print("Embedding error:", e)

    print("Embeddings stored:", embedded_count)

    # rebuild FAISS index
    if embedded_count > 0:

        build_faiss_index()

        print("FAISS index rebuilt")

    return {
        "msg": "Upload successful",
        "chunks_created": embedded_count
    }