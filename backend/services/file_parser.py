import os
import pandas as pd
from docx import Document
from pypdf import PdfReader
import fitz # PyMuPDF
from services.ocr_service import process_image_ocr, process_pdf_page_ocr
import json


def parse_file(file_path):

    ext = os.path.splitext(file_path)[1].lower()

    text = ""

    try:

        # ---------------- PDF ----------------
        if ext == ".pdf":

            reader = PdfReader(file_path)
            pdf_document = fitz.open(file_path)

            for i, page in enumerate(reader.pages):

                page_text = page.extract_text()

                if page_text and page_text.strip():
                    text += page_text + "\n"
                else:
                    if i < len(pdf_document):
                        fitz_page = pdf_document.load_page(i)
                        ocr_text = process_pdf_page_ocr(fitz_page)
                        if ocr_text:
                            text += ocr_text + "\n"

                # limit pages for speed
                if i >= 30:
                    break
            
            pdf_document.close()


        # ---------------- TXT ----------------
        elif ext == ".txt":

            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()


        # ---------------- DOCX ----------------
        elif ext == ".docx":

            doc = Document(file_path)

            text = "\n".join([p.text for p in doc.paragraphs if p.text])


        # ---------------- CSV ----------------
        elif ext == ".csv":

            df = pd.read_csv(file_path)

            # limit rows for performance
            df = df.head(300)

            text = df.to_string(index=False)


        # ---------------- EXCEL ----------------
        elif ext in [".xlsx", ".xls"]:

            df = pd.read_excel(file_path)

            # limit rows
            df = df.head(300)

            text = df.to_string(index=False)


        # ---------------- JSON ----------------
        elif ext == ".json":

            with open(file_path) as f:

                data = json.load(f)

            text = json.dumps(data, indent=2)


        # ---------------- IMAGE (OCR) ----------------
        elif ext in [".png", ".jpg", ".jpeg"]:

            text = process_image_ocr(file_path)


    except Exception as e:

        print("File parsing error:", e)

    return text