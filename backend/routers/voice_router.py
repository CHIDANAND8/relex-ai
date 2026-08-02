from fastapi import APIRouter, File, UploadFile, HTTPException
import os
import uuid
from services.audio_service import transcribe_audio

router = APIRouter(prefix="/voice")

@router.post("/transcribe")
async def voice_transcribe(file: UploadFile = File(...)):
    # Save target audio file temporarily
    os.makedirs("uploads", exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    if not ext:
        ext = ".wav" # Web recorder fallback standard
        
    unique_name = f"voice_{uuid.uuid4()}{ext}"
    file_path = os.path.join("uploads", unique_name)
    
    try:
        # Write contents
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Call whisper wrapper
        transcription = transcribe_audio(file_path)
        
        # Cleanup file context after transcription completes
        if os.path.exists(file_path):
            os.remove(file_path)
            
        return {"text": transcription.strip()}
        
    except Exception as e:
        print("Transcription exception occurred:", e)
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))
