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

# Fallback static registry for Groq Cloud
DEFAULT_GROQ_MODELS = [
    {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B",
        "badge": "🧠 High Accuracy",
        "description": "Deep reasoning & highest accuracy for complex Q&A and coding",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": True
    },
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B",
        "badge": "⚡ Ultra Fast",
        "description": "Lightning-fast responses for everyday conversations",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
    {
        "id": "llama3-70b-8192",
        "name": "Llama 3 70B",
        "badge": "🔬 Versatile",
        "description": "High-capacity reasoning and structured output",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
    {
        "id": "llama3-8b-8192",
        "name": "Llama 3 8B",
        "badge": "⚡ Fast",
        "description": "Fast and lightweight Meta model",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
    {
        "id": "mixtral-8x7b-32768",
        "name": "Mixtral 8x7B",
        "badge": "🔬 Deep Logic",
        "description": "32k long-context window for complex technical analysis",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
    {
        "id": "gemma2-9b-it",
        "name": "Gemma 2 9B",
        "badge": "💎 Balanced",
        "description": "Google's high-efficiency model balancing speed and quality",
        "provider": "groq",
        "provider_label": "☁️ Groq Cloud",
        "default": False
    },
]

def fetch_groq_models():
    """Dynamically query Groq API for available chat models, falling back to DEFAULT_GROQ_MODELS."""
    if not client:
        return DEFAULT_GROQ_MODELS
    try:
        models_data = client.models.list()
        chat_model_ids = {m.id for m in models_data.data if not m.id.startswith("whisper")}
        
        # Filter and prioritize models from our metadata registry
        active = [m for m in DEFAULT_GROQ_MODELS if m["id"] in chat_model_ids]
        if active:
            active[0]["default"] = True
            return active
        return DEFAULT_GROQ_MODELS
    except Exception as e:
        print(f"Error fetching Groq models list: {e}")
        return DEFAULT_GROQ_MODELS

GROQ_MODELS = DEFAULT_GROQ_MODELS


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
    """Return dynamically detected Groq cloud + detected local Ollama models."""
    groq = fetch_groq_models()
    local = fetch_local_ollama_models()
    return groq + local


# Default Groq fallback values
DEFAULT_MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "llama-3.2-11b-vision-preview"


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
      - 'ollama:...'  prefix or local Ollama match → local Ollama instance
      - everything else                            → Groq Cloud API with multi-fallback
    """

    # ---- LOCAL OLLAMA ----
    if model.startswith("ollama:") or any(model.startswith(k) for k in KNOWN_OLLAMA_META.keys()):
        ollama_model_name = model[len("ollama:"):] if model.startswith("ollama:") else model
        yield from stream_ollama_local(prompt, ollama_model_name, images=images)
        return

    # ---- GROQ CLOUD ----
    if not client:
        # Check if local Ollama has any model
        local = fetch_local_ollama_models()
        if local:
            mname = local[0]["id"].replace("ollama:", "")
            yield from stream_ollama_local(prompt, mname, images=images)
            return
        yield "\n[Error: GROQ_API_KEY not configured and no local Ollama models detected]"
        return

    # Build fallback candidates list starting with requested model
    fallback_candidates = [model, "llama-3.3-70b-versatile", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma2-9b-it", "llama3-8b-8192", "llama-3.1-8b-instant"]
    # De-duplicate preserving order
    seen = set()
    models_to_try = [x for x in fallback_candidates if not (x in seen or seen.add(x))]

    for candidate_model in models_to_try:
        try:
            messages = []
            use_model = candidate_model

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
            return  # Successful stream completion

        except Exception as e:
            print(f"Groq stream attempt failed (Model: {candidate_model}): {e}")
            continue

    # If all Groq attempts failed, check if local Ollama is available
    local_models = fetch_local_ollama_models()
    if local_models:
        first_local = local_models[0]["id"].replace("ollama:", "")
        print(f"Falling back to local Ollama model: {first_local}")
        yield from stream_ollama_local(prompt, first_local, images=images)
        return

    yield "\n[Error: AI models are currently unreachable. Please verify your Groq API key or start local Ollama (`ollama serve`).]"



# =========================================================
# NON-STREAMING CHAT (used internally by document converters & services)
# =========================================================
def chat(prompt: str, model: str = DEFAULT_MODEL):
    """Non-streaming blocking chat with multi-model fallback."""
    if model.startswith("ollama:") or any(model.startswith(k) for k in KNOWN_OLLAMA_META.keys()):
        ollama_model_name = model[len("ollama:"):] if model.startswith("ollama:") else model
        result = ""
        for tok in stream_ollama_local(prompt, ollama_model_name):
            result += tok
        return result

    if not client:
        local_models = fetch_local_ollama_models()
        if local_models:
            first_local = local_models[0]["id"].replace("ollama:", "")
            result = ""
            for tok in stream_ollama_local(prompt, first_local):
                result += tok
            return result
        return "[Error: GROQ_API_KEY not configured and no local Ollama models detected]"

    fallback_candidates = [model, "llama-3.3-70b-versatile", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma2-9b-it", "llama3-8b-8192", "llama-3.1-8b-instant"]
    seen = set()
    models_to_try = [x for x in fallback_candidates if not (x in seen or seen.add(x))]

    for candidate_model in models_to_try:
        try:
            response = client.chat.completions.create(
                model=candidate_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2048
            )
            if response.choices and response.choices[0].message.content:
                return response.choices[0].message.content
        except Exception as e:
            print(f"Groq chat attempt failed (Model: {candidate_model}): {e}")
            continue

    local_models = fetch_local_ollama_models()
    if local_models:
        first_local = local_models[0]["id"].replace("ollama:", "")
        result = ""
        for tok in stream_ollama_local(prompt, first_local):
            result += tok
        return result

    return "[Error: AI models are currently unreachable. Please check your network or Groq API key.]"

# Keep backward compatibility alias
AVAILABLE_MODELS = DEFAULT_GROQ_MODELS