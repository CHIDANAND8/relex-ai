from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import time
from services.doc_exporter import generate_pdf_report

router = APIRouter(prefix="/export")

class ExportRequest(BaseModel):
    title: str
    content: str

@router.post("/pdf")
def export_pdf(data: ExportRequest):
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
        
    os.makedirs("uploads", exist_ok=True)
    filename = f"export_{int(time.time())}.pdf"
    file_path = os.path.join("uploads", filename)
    
    try:
        generate_pdf_report(data.title, data.content, file_path)
    except Exception as e:
        print("PDF Export Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
        
    return {
        "ok": True,
        "pdf_url": f"http://localhost:8000/uploads/{filename}"
    }
