import os
import re
import base64
import numpy as np
import fitz  # PyMuPDF

# Optional OCR dependencies
try:
    import cv2
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    cv2 = None
    easyocr = None
    OCR_AVAILABLE = False

# Lazy initialization of easyocr reader
_reader = None

def get_reader():
    global _reader
    if not OCR_AVAILABLE:
        return None
    if _reader is None:
        try:
            _reader = easyocr.Reader(['en'], gpu=False)
        except Exception as e:
            print("Failed to initialize EasyOCR reader:", e)
            return None
    return _reader

def clean_ocr_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()

def preprocess_image(image_bytes: bytes):
    if not cv2:
        return None
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        # Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Upscale for small font clarity
        gray = cv2.resize(gray, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
        # Gentle denoising
        blur = cv2.GaussianBlur(gray, (3, 3), 0)
        return blur
    except Exception as e:
        print("Preprocessing image error:", e)
        return None

def extract_ocr_via_vision_llm(file_path: str) -> str:
    """Fallback OCR using Groq Vision model for accurate text, tables, and document transcription."""
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key or not os.path.exists(file_path):
        return ""

    try:
        from groq import Groq
        client = Groq(api_key=groq_key)

        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        prompt = (
            "Transcribe all visible text, numbers, data tables, fields, headings, and labels from this image or document. "
            "Maintain the exact layout and structure (e.g., format tables with Markdown, preserve lines). "
            "Output ONLY the extracted transcription without conversational intro or commentary."
        )

        response = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
                ]
            }],
            temperature=0.1,
            max_tokens=2048
        )

        if response.choices and response.choices[0].message.content:
            return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Vision OCR fallback error for {file_path}: {e}")

    return ""

def process_image_ocr(file_path: str) -> str:
    """
    Multi-engine OCR pipeline:
    1. Try EasyOCR on raw file
    2. Try EasyOCR on preprocessed image
    3. Fallback to Groq Vision model for multimodal OCR
    """
    if not os.path.exists(file_path):
        return ""

    extracted_lines = []

    reader = get_reader()
    if reader:
        try:
            # 1. Attempt raw image read
            raw_results = reader.readtext(file_path, detail=0, paragraph=True)
            for item in raw_results:
                cleaned = clean_ocr_text(str(item))
                if cleaned:
                    extracted_lines.append(cleaned)
        except Exception as e:
            print(f"EasyOCR raw read failed: {e}")

        # If raw gave sparse results, attempt preprocessed image
        if len(" ".join(extracted_lines)) < 40 and cv2:
            try:
                with open(file_path, "rb") as f:
                    image_bytes = f.read()
                processed = preprocess_image(image_bytes)
                if processed is not None:
                    prep_results = reader.readtext(processed, detail=0, paragraph=True)
                    prep_lines = [clean_ocr_text(str(x)) for x in prep_results if clean_ocr_text(str(x))]
                    if len(" ".join(prep_lines)) > len(" ".join(extracted_lines)):
                        extracted_lines = prep_lines
            except Exception as e:
                print(f"EasyOCR preprocessed read failed: {e}")

    # If local OCR gave empty or very short text, use Vision LLM
    text_content = "\n\n".join(extracted_lines).strip()
    if len(text_content) < 15:
        vision_text = extract_ocr_via_vision_llm(file_path)
        if vision_text:
            return vision_text

    return text_content

def process_pdf_page_ocr(page) -> str:
    """Render PDF page to high-res image and perform OCR."""
    try:
        pix = page.get_pixmap(dpi=250)
        image_bytes = pix.tobytes("png")

        reader = get_reader()
        if reader:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) if cv2 else None
            if img is not None:
                results = reader.readtext(img, detail=0, paragraph=True)
                lines = [clean_ocr_text(str(x)) for x in results if clean_ocr_text(str(x))]
                if lines:
                    return "\n\n".join(lines)

        # Fallback: save temp image and run vision OCR
        temp_path = f"uploads/temp_ocr_page.png"
        os.makedirs("uploads", exist_ok=True)
        pix.save(temp_path)
        result = process_image_ocr(temp_path)
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return result
    except Exception as e:
        print(f"Error in PDF page OCR: {e}")
        return ""
