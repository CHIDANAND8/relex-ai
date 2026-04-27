import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"

# Default model (good balance for RAG)
MODEL_NAME = "llama3.2"

# Backup models (avoid heavy models)
FALLBACK_MODELS = [
    "qwen2.5:1.5b"
]


# =========================================================
# STREAM RESPONSE FROM OLLAMA
# =========================================================

def chat_stream(prompt: str, model: str = MODEL_NAME, images: list = None):

    if images:
        models_to_try = ["llava:latest"] + [model] + FALLBACK_MODELS
    else:
        models_to_try = [model] + FALLBACK_MODELS

    for current_model in models_to_try:

        try:
            payload = {
                "model": current_model,
                "prompt": prompt,
                "stream": True,
                "keep_alive": "2h",
                "options": {
                    "temperature": 0.5,
                    "top_p": 0.9,
                    "num_predict": 512
                }
            }
            
            if images:
                payload["images"] = images

            response = requests.post(
                OLLAMA_URL,
                json=payload,
                stream=True,
                timeout=(5, 180)   # FIX: better streaming timeout
            )

        except requests.exceptions.RequestException as e:

            print("Ollama connection error:", e)
            continue

        if response.status_code != 200:

            print("Ollama error:", response.text)
            continue

        try:

            for line in response.iter_lines(decode_unicode=True):

                if not line:
                    continue

                try:
                    data = json.loads(line)
                except:
                    continue

                token = data.get("response", "")

                if token:
                    yield token

                if data.get("done", False):
                    break

        except Exception as e:

            print("Stream parse error:", e)
            continue

        return

    yield "\n[Error: Ollama server not reachable]"


# =========================================================
# NON-STREAM RESPONSE
# =========================================================

def chat(prompt: str, model: str = MODEL_NAME):

    models_to_try = [model] + FALLBACK_MODELS

    for current_model in models_to_try:

        try:

            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": current_model,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "2h",
                    "options": {
                        "temperature": 0.5,
                        "top_p": 0.9,
                        "num_predict": 512
                    }
                },
                timeout=(5, 180)   # FIX
            )

            if response.status_code != 200:
                continue

            data = response.json()

            return data.get("response", "")

        except Exception as e:

            print("Ollama error:", e)
            continue

    return "[Error: Ollama server not reachable]"