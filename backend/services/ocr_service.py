import os
import cv2
import numpy as np
import easyocr
import fitz  # PyMuPDF
import re

# Lazy initialization of easyocr reader
_reader = None

def get_reader():
    global _reader
    if _reader is None:
        # Load English, fallback to CPU if GPU not available
        _reader = easyocr.Reader(['en'], gpu=True) 
    return _reader

def clean_ocr_text(text):
    if not text:
        return ""
    # Remove excessive spaces and newlines
    text = re.sub(r"\s+", " ", text)
    # Remove special chars that might be noise from OCR, keep basic punctuation
    text = re.sub(r"[^\w\s\.\,\?\!\-\:\;\(\)\[\]\%]", "", text)
    return text.strip()

def preprocess_image(image_bytes):
    # Convert bytes to numpy array for cv2
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return None

    # Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Resize image to improve OCR accuracy (scale up by 2x)
    gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    
    # Noise removal with median blur
    blur = cv2.medianBlur(gray, 3)
    
    # Adaptive thresholding for handling varying illumination
    thresh = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    
    return thresh

def process_image_ocr(file_path):
    try:
        with open(file_path, "rb") as f:
            image_bytes = f.read()

        processed_img = preprocess_image(image_bytes)
        if processed_img is None:
            return ""

        reader = get_reader()
        
        # detail=1, paragraph=True groups words into paragraphs automatically
        results = reader.readtext(processed_img, detail=1, paragraph=True)
        
        text_blocks = []
        for bbox, text in results:
            cleaned = clean_ocr_text(text)
            if cleaned:
                text_blocks.append(cleaned)
                
        return "\n\n".join(text_blocks)

    except Exception as e:
        print(f"Error in OCR image processing ({file_path}): {e}")
        return ""

def process_pdf_page_ocr(page):
    try:
        # Render PDF page to an image (300 DPI for better OCR)
        pix = page.get_pixmap(dpi=300)
        image_bytes = pix.tobytes("png")
        
        processed_img = preprocess_image(image_bytes)
        if processed_img is None:
            return ""
            
        reader = get_reader()
        results = reader.readtext(processed_img, detail=1, paragraph=True)
        
        text_blocks = []
        for bbox, text in results:
            cleaned = clean_ocr_text(text)
            if cleaned:
                text_blocks.append(cleaned)
                
        return "\n\n".join(text_blocks)
        
    except Exception as e:
        print(f"Error in OCR PDF page processing: {e}")
        return ""
