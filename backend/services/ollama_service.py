import os
import json
import requests as http_requests
from groq import Groq

# =========================================================
# GROQ CLOUD CLIENT
# =========================================================
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

OLLAMA_BASE_URL = "http://localhost:11434"

# =========================================================
# MODELS REGISTRY
# =========================================================
# Embedding / utility-only models to exclude from chat selection
EXCLUDED_OLLAMA_MODELS = {"nomic-embed-text", "nomic-embed-text:latest", "all-minilm", "mxbai-embed"}

GROQ_MODELS = [
    {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B",
        "badge": "🧠 High Accuracy",
        "description": "GPT-4 level reasoning — highest accuracy for complex Q&A and document analysis",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": True
    },
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B",
        "badge": "⚡ Ultra Fast",
        "description": "Lightning-fast responses for everyday conversations and quick answers",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
    {
        "id": "mixtral-8x7b-32768",
        "name": "Mixtral 8x7B",
        "badge": "🔬 Deep Logic",
        "description": "32k long-context window for complex multi-step technical analysis",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
    {
        "id": "gemma2-9b-it",
        "name": "Gemma 2 9B",
        "badge": "💎 Balanced",
        "description": "Google's high-efficiency model balancing speed and nuanced understanding",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
]

# Metadata for known local Ollama models for better display
KNOWN_OLLAMA_META = {
    "llama3.2":    {"badge": "🦙 Meta Local", "description": "Meta's efficient Llama 3.2 model running 100% offline on your device"},
    "llama3.1":    {"badge": "🦙 Meta Local", "description": "Meta's Llama 3.1 model running offline on your device"},
    "llava":       {"badge": "👁️ Vision Local", "description": "Local multimodal vision model — can analyze images & documents offline"},
    "qwen2.5":     {"badge": "🚀 Qwen Local", "description": "Alibaba's Qwen 2.5 ultra-fast lightweight local model — great for quick answers"},
    "qwen2":       {"badge": "🚀 Qwen Local", "description": "Alibaba's Qwen 2 model running locally on your device"},
    "mistral":     {"badge": "💻 Local",       "description": "Mistral AI's model running locally on your device"},
    "codellama":   {"badge": "💡 Code Local",  "description": "Meta's coding-specialized LLaMA model for programming tasks, running locally"},
    "deepseek":    {"badge": "🧠 Reasoning",   "description": "DeepSeek reasoning model running locally on your device"},
    "gemma":       {"badge": "💎 Local",        "description": "Google's Gemma model running locally on your device"},
    "phi":         {"badge": "🔬 Phi Local",   "description": "Microsoft Phi model running locally on your device"},
}


def fetch_local_ollama_models():
    """Query Ollama at localhost:11434 to get list of installed models."""
    try:
        resp = http_requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if resp.status_code != 200:
            return []

        data = resp.json()
        models_raw = data.get("models", [])

        local_models = []
        for m in models_raw:
            raw_name = m.get("name", "")

            # Skip embedding / non-chat models
            base_name = raw_name.split(":")[0].lower()
            if any(ex in raw_name.lower() for ex in EXCLUDED_OLLAMA_MODELS):
                continue

            # Lookup display metadata
            meta = None
            for key, val in KNOWN_OLLAMA_META.items():
                if key in base_name:
                    meta = val
                    break
            if meta is None:
                meta = {"badge": "💻 Local", "description": f"Local Ollama model {raw_name} running on your device"}

            # Friendly name: capitalize model name
            friendly = base_name.replace("-", " ").replace(".", " ").title()
            tag = raw_name.split(":")[1] if ":" in raw_name else "latest"
            size_bytes = m.get("size", 0)
            size_str = f"{round(size_bytes / 1e9, 1)} GB" if size_bytes > 1e9 else f"{round(size_bytes / 1e6)} MB"

            local_models.append({
                "id": f"ollama:{raw_name}",
                "name": f"{friendly} ({tag})",
                "badge": meta["badge"],
                "description": f"{meta['description']} — {size_str}",
                "provider": "ollama",
                "provider_label": "💻 Local Ollama",
                "default": False
            })

        return local_models

    except Exception as e:
        print(f"Ollama not reachable (skipping local models): {e}")
        return []


def get_all_available_models():
    """Return combined Groq cloud + detected local Ollama models."""
    local = fetch_local_ollama_models()
    return GROQ_MODELS + local


# Default Groq fallback values
DEFAULT_MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "llama-3.2-11b-vision-preview"
VALID_GROQ_IDS = {m["id"] for m in GROQ_MODELS}


# =========================================================
# LOCAL OLLAMA STREAMING
# =========================================================
def stream_ollama_local(prompt: str, model_name: str, images: list = None):
    """Stream response tokens from local Ollama via HTTP."""
    payload = {
        "model": model_name,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}]
    }

    # If images are passed and model is vision-capable (llava), encode them
    if images and "llava" in model_name.lower():
        payload["messages"] = [{
            "role": "user",
            "content": prompt,
            "images": images   # base64 strings
        }]

    try:
        with http_requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            stream=True,
            timeout=120
        ) as resp:
            if resp.status_code != 200:
                yield f"\n[Error: Ollama returned status {resp.status_code}]"
                return

            for line in resp.iter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    token = obj.get("message", {}).get("content", "")
                    if token:
                        yield token
                    if obj.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

    except http_requests.exceptions.ConnectionError:
        yield "\n[Error: Cannot connect to Ollama. Make sure `ollama serve` is running on your machine.]"
    except Exception as e:
        print(f"Ollama streaming error ({model_name}):", e)
        yield f"\n[Error: Ollama error - {str(e)}]"


# =========================================================
# UNIFIED CHAT STREAM  (Groq Cloud + Local Ollama)
# =========================================================
def chat_stream(prompt: str, model: str = DEFAULT_MODEL, images: list = None):
    """
    Routes streaming requests:
      - 'ollama:...'  prefix → local Ollama instance
      - everything else      → Groq Cloud API
    """

    # ---- LOCAL OLLAMA ----
    if model.startswith("ollama:"):
        ollama_model_name = model[len("ollama:"):]
        yield from stream_ollama_local(prompt, ollama_model_name, images=images)
        return

    # ---- GROQ CLOUD ----
    if not client:
        yield "\n[Error: GROQ_API_KEY not found in backend/.env]"
        return

    selected_model = model if model in VALID_GROQ_IDS else DEFAULT_MODEL

    try:
        messages = []
        use_model = selected_model

        if images:
            content = [{"type": "text", "text": prompt}]
            for img in images:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img}"}
                })
            messages.append({"role": "user", "content": content})
            use_model = VISION_MODEL
        else:
            messages.append({"role": "user", "content": prompt})

        stream = client.chat.completions.create(
            model=use_model,
            messages=messages,
            stream=True,
            temperature=0.5,
            max_tokens=2048
        )

        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        print(f"Groq stream error (Model: {selected_model}):", e)
        # Fallback to fast cloud model
        if selected_model != "llama-3.1-8b-instant":
            try:
                print("Falling back to llama-3.1-8b-instant...")
                fb_stream = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": prompt}],
                    stream=True,
                    temperature=0.5,
                    max_tokens=2048
                )
                for chunk in fb_stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as fe:
                print("Fallback also failed:", fe)
        yield f"\n[Error: Groq API error - {str(e)}]"


# =========================================================
# NON-STREAMING CHAT (used internally by some services)
# =========================================================
def chat(prompt: str, model: str = DEFAULT_MODEL):
    if model.startswith("ollama:"):
        # Collect full response from local stream
        result = ""
        for tok in stream_ollama_local(prompt, model[len("ollama:"):]):
            result += tok
        return result

    if not client:
        return "[Error: GROQ_API_KEY not found in backend/.env]"

    selected_model = model if model in VALID_GROQ_IDS else DEFAULT_MODEL
    try:
        response = client.chat.completions.create(
            model=selected_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=2048
        )
        if response.choices:
            return response.choices[0].message.content
        return ""
    except Exception as e:
        print(f"Groq error (Model: {selected_model}):", e)
        return f"[Error: Groq API error - {str(e)}]"

# Keep backward compatibility alias
AVAILABLE_MODELS = GROQ_MODELS