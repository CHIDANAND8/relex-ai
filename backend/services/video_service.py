import subprocess
import os
from services.audio_service import transcribe_audio


# =========================================================
# EXTRACT AUDIO FROM VIDEO
# =========================================================

def extract_audio(video_path):

    audio_path = video_path + ".wav"

    try:

        result = subprocess.run(
            [
                "ffmpeg",
                "-i",
                video_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                audio_path
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=120
        )

        if result.returncode != 0:
            print("FFmpeg failed for:", video_path)
            return None

        if not os.path.exists(audio_path):
            return None

        return audio_path

    except subprocess.TimeoutExpired:
        print("FFmpeg extraction timeout")
        return None

    except Exception as e:
        print("Video audio extraction error:", e)
        return None


# =========================================================
# PROCESS VIDEO
# =========================================================

def process_video(video_path):

    audio = extract_audio(video_path)

    if not audio:
        return ""

    transcript = ""

    try:

        transcript = transcribe_audio(audio)

    except Exception as e:

        print("Video transcription error:", e)

    # cleanup temp audio
    try:
        if os.path.exists(audio):
            os.remove(audio)
    except Exception as e:
        print("Audio cleanup error:", e)

    return transcript