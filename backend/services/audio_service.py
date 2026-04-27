import subprocess
import os


# =========================================================
# AUDIO TRANSCRIPTION
# =========================================================

def transcribe_audio(file_path: str):

    if not os.path.exists(file_path):
        print("Audio file not found:", file_path)
        return ""

    try:

        result = subprocess.run(
            [
                "ollama",
                "run",
                "whisper",
                file_path
            ],
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            print("Whisper error:", result.stderr)
            return ""

        output = result.stdout.strip()

        if not output:
            return ""

        return output

    except subprocess.TimeoutExpired:
        print("Audio transcription timeout")
        return ""

    except Exception as e:
        print("Audio transcription error:", e)
        return ""