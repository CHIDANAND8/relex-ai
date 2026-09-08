from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Message, Conversation

from services.rag_service import (
    get_feed_context,
    get_memory_context,
    get_document_context
)
from services.ollama_service import chat_stream, AVAILABLE_MODELS, get_all_available_models
from services.web_search_service import perform_web_search
from services.web_scraper_service import scrape_url_context

from routers.conversation_router import (
    increment_unread,
    update_conversation_title_if_default
)

import time
import re
import json
import base64
import os
import urllib.parse
import requests

router = APIRouter()


# =========================================================
# SCHEMAS
# =========================================================

class ChatRequest(BaseModel):
    username: str
    conversation_id: int
    message: str
    model: str = "llama-3.3-70b-versatile"
    persona: str = "default"


class EditRequest(BaseModel):
    conversation_id: int
    content: str
    parent_id: int


# =========================================================
# DATABASE
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# HELPER
# =========================================================

def extract_target_user(question: str):
    match = re.search(r"user\d+", question.lower())
    return match.group() if match else None


# =========================================================
# QUERY TYPE DETECTOR (INTENT CLASSIFICATION)
# =========================================================

def detect_query_type(question: str):
    q = question.lower().strip()

    # 0. Image Generation Intent
    q_lower = q.lower()
    
    # Robust RegEx to capture casual generation prompts
    gen_pattern = r"\b(draw|paint|illustrate)\b|\b(picture|image|photo|logo|art) of\b|\b(generate|create|render).{0,15}(image|picture|photo|art|logo|portrait|landscape)\b"
    
    # Direct visual triggers check if seeking an actor/person portrait or ending with trigger words
    visual_triggers = ["image", "photo", "picture", "portrait", "sketch"]
    is_visual_request = False
    if any(trigger in q_lower for trigger in visual_triggers):
        action_verbs = ["show", "give", "make", "create", "generate", "display", "output", "want", "need", "find", "get"]
        actor_keywords = ["actor", "hero", "dboss", "darshan", "celebrity", "person", "man", "woman", "girl", "boy"]
        if any(verb in q_lower for verb in action_verbs) or q_lower.strip().endswith(tuple(visual_triggers)) or any(kw in q_lower for kw in actor_keywords):
            is_visual_request = True

    if re.search(gen_pattern, q_lower) or is_visual_request:
        # Prevent false positives where the user is just asking to read a document or write code
        anti_patterns = ["my", "uploaded", "document", "pdf", "file", "adhaar", "aadhar", "resume", "cv", "read", "extract", "code", "python", "script", "program", "function", "app", "website", "html", "javascript", "js", "css", "why", "how", "what is"]
        if not any(anti in q_lower for anti in anti_patterns):
            return "generation"

    # 0.5 File Generation Intent
    file_gen_pattern = r"\b(generate|create|make|build|convert|save|download|export|provide).{0,25}(excel|csv|spreadsheet|pdf|word|document|docx|doc|txt|text file)\b"
    if re.search(file_gen_pattern, q_lower):
        return "file_generation"

    # 0.7 Web Search Intent
    search_pattern = r"\b(search web|search the web|latest news|current price|look up|find online|google)\b"
    if re.search(search_pattern, q_lower) or "today" in q_lower or "right now" in q_lower or "latest" in q_lower:
        return "web_search"

    # 1. Casual Intent
    casual_words = {"hello", "hi", "hey", "how are you", "good morning", "good evening", "thanks", "thank you", "bye", "goodbye", "gm", "gn"}
    if q in casual_words or any(q.startswith(w + " ") for w in casual_words):
        return "casual"

    # 2. Admin Intent — ONLY match explicit HR/payroll/announcement-style queries
    # Use multi-word phrases or very specific terms to avoid false matches on general questions
    admin_keywords = [
        "my salary", "my pay", "my ctc", "my bonus", "my promotion",
        "my leave", "my holiday", "my payslip", "my compensation",
        "salary slip", "pay slip", "ctc breakdown", "increment",
        "admin message", "admin feed", "announcement", "company policy",
        "hr update", "hr notice", "hr message"
    ]
    for phrase in admin_keywords:
        if phrase in q_lower:
            return "admin"

    # 3. Document Intent
    file_keywords = [
        "pdf", "document", "file", "excel", "spreadsheet", "table",
        "chart", "graph", "image", "screenshot", "picture", "code",
        "script", "program", "upload", "page", "cv", "resume",
        "adhaar", "aadhar", "card", "id card", "identity", "elector", "passport",
        "csv"
    ]
    for word in file_keywords:
        if word in q_lower:
            return "document"

    # 4. General Intent (Fallback)
    return "general"


# =========================================================
# LAST MESSAGE
# =========================================================

def get_last_message(db: Session, conv_id: int):

    return (
        db.query(Message)
        .filter(
            Message.conversation_id == conv_id,
            Message.is_deleted == False
        )
        .order_by(Message.created_at.desc())
        .first()
    )


# =========================================================
# MODELS LIST ENDPOINT
# =========================================================

@router.get("/models")
def get_available_models():
    """Returns all available models: Groq cloud + locally installed Ollama models."""
    return {"models": get_all_available_models()}


# =========================================================
# CHAT ROUTE
# =========================================================

@router.post("/chat")
def chat(request: Request, data: ChatRequest, db: Session = Depends(get_db)):
    base_url_str = str(request.base_url).rstrip('/')

    username = data.username
    conv_id = data.conversation_id
    question = data.message.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # =====================================================
    # BRANCH LOGIC
    # =====================================================

    last_msg = get_last_message(db, conv_id)

    parent_id = last_msg.id if last_msg else None
    branch_id = last_msg.branch_id if last_msg else 0

    # =====================================================
    # SAVE USER MESSAGE
    # =====================================================

    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=question,
        parent_id=parent_id,
        branch_id=branch_id,
        is_deleted=False
    )

    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    
    user_msg_id = user_msg.id

    update_conversation_title_if_default(db, conv_id, question)

    # =====================================================
    # STRICT CONTEXT ROUTING
    # =====================================================

    query_type = detect_query_type(question)

    # =====================================================
    # NATIVE TEXT-TO-IMAGE BYPASS
    # =====================================================
    if query_type == "generation":
        # Polish prompt by removing operational trigger words natively using regex
        prompt = re.sub(r"^(can you |please |could you )?(generate|create|draw|paint|render|make|give me) (an |a |the )?(image|picture|photo)( of a | of an | of )?", "", question, flags=re.IGNORECASE)
        prompt = re.sub(r"^(picture|image|photo) of (a |an |the )?", "", prompt, flags=re.IGNORECASE)
        
        prompt = prompt.strip()
        # Remove trailing visual triggers
        prompt = re.sub(r"\s+(image|photo|picture|photograph|portrait|sketch|hero)$", "", prompt, flags=re.IGNORECASE).strip()
        
        if not prompt or prompt.lower() in ["image", "picture", "photo"]:
            prompt = "beautiful highly detailed landscape"

        # Apply smart celebrity mappings and realism styling
        prompt_lower = prompt.lower()
        if "dboss" in prompt_lower or "d-boss" in prompt_lower or "thriller hero darshan" in prompt_lower or "actor darshan" in prompt_lower:
            prompt = "Kannada actor Darshan Thoogudeepa (D-Boss)"
            style_suffix = ", highly realistic 8k portrait photo of Kannada actor Darshan Thoogudeepa (D-Boss), standing with hero pose, sharp focus, detailed facial features, realistic skin texture, neutral expressions, cinematic lighting, photorealistic, shot with DSLR camera"
        else:
            style_suffix = ", cinematic masterpiece highly detailed visually stunning 8k resolution photorealistic realism raw portrait/landscape photo"

        clean_prompt = "".join(c for c in prompt if c.isalnum() or c.isspace() or c == ',')
        clean_prompt = clean_prompt[:200] # Safe URL limit

        encoded_prompt = urllib.parse.quote(clean_prompt + style_suffix)
        seed = int(time.time() * 1000) % 100000 
        raw_image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&width=512&height=512&nologo=true"
        
        def stream_generation():
            # Yield loading indicator instantly
            yield f"✨ **Generating Image:** *{prompt}*... Please wait.\n\n"
            
            final_image_url = ""
            
            # Helper to save image
            def save_image(content, prefix="gen"):
                os.makedirs("uploads", exist_ok=True)
                fname = f"{prefix}_{int(time.time())}_{seed}.jpg"
                fpath = os.path.join("uploads", fname)
                with open(fpath, "wb") as f:
                    f.write(content)
                return f"{base_url_str}/uploads/{fname}"

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "image/jpeg,image/png,image/webp,*/*;q=0.8"
            }

            # 1. Try Pollinations API
            poll_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&width=512&height=512&nologo=true"
            try:
                res = requests.get(poll_url, headers=headers, timeout=20)
                if res.status_code == 200 and "image" in res.headers.get("Content-Type", "") and len(res.content) > 5000:
                    final_image_url = save_image(res.content, "poll")
            except Exception:
                pass

            # 2. Fallback to Lexica API if Pollinations failed or returned Cloudflare HTML
            if not final_image_url:
                try:
                    lexica_url = f"https://lexica.art/api/v1/search?q={urllib.parse.quote(clean_prompt)}"
                    res = requests.get(lexica_url, headers=headers, timeout=15)
                    if res.status_code == 200:
                        data = res.json()
                        if "images" in data and len(data["images"]) > 0:
                            # Use the top result
                            img_url = data["images"][0]["src"]
                            img_res = requests.get(img_url, headers=headers, timeout=15)
                            if img_res.status_code == 200 and len(img_res.content) > 5000:
                                final_image_url = save_image(img_res.content, "lex")
                            else:
                                final_image_url = img_url # fallback to raw URL
                except Exception:
                    pass

            if not final_image_url:
                final_image_url = poll_url # Absolute last resort

            # Yield the final image markdown
            yield f"![Generated Art]({final_image_url})"
            
            # Save the full combined message to the DB
            full_msg = f"✨ **Image Generated:** *{prompt}*\n\n![Generated Art]({final_image_url})"
            ai_msg = Message(
                conversation_id=conv_id,
                role="assistant",
                content=full_msg,
                parent_id=user_msg_id,
                branch_id=branch_id,
                is_deleted=False
            )
            db.add(ai_msg)
            increment_unread(db, conv_id)
            db.commit()

        return StreamingResponse(
            stream_generation(),
            media_type="text/plain",
            headers={"X-AI-Context": "{}"}
        )

    mem_ctx = get_memory_context(db, conv_id, branch_id) or ""
    
    # Pre-fetch Document & OCR Context and Image paths for conversation
    doc_ctx = ""
    feed_ctx = ""
    web_ctx = ""
    image_paths = []

    doc_result = get_document_context(db, question, conv_id)
    if isinstance(doc_result, tuple):
        doc_ctx, doc_img_paths = doc_result
        image_paths.extend(doc_img_paths)
    else:
        doc_ctx = doc_result

    # =====================================================
    # NATIVE DOCUMENT & OCR CONVERSION / GENERATION (EXCEL, WORD, PDF, CSV)
    # =====================================================
    if query_type == "file_generation":
        from services.ollama_service import chat as blocking_chat
        from services.doc_exporter import (
            generate_pdf_report,
            generate_docx_report,
            generate_excel_report,
            generate_csv_report,
            generate_text_report
        )
        
        def stream_file_generation():
            # Determine target file type
            q_lower = question.lower()
            file_type = "txt"
            ext = ".txt"
            if any(w in q_lower for w in ["excel", "spreadsheet", "xlsx"]):
                file_type = "Excel Spreadsheet"
                ext = ".xlsx"
            elif "csv" in q_lower:
                file_type = "CSV Data File"
                ext = ".csv"
            elif any(w in q_lower for w in ["word", "docx", "doc"]):
                file_type = "Word Document"
                ext = ".docx"
            elif "pdf" in q_lower:
                file_type = "PDF Document"
                ext = ".pdf"
            
            yield f"⚙️ **Processing & Converting {file_type}...**\n\n"
            
            # System prompt with full document / OCR context
            system_prompt = (
                f"You are a specialized Data Extraction and File Conversion AI. The user requested conversion into a {file_type}.\n"
                "Extract all relevant information, tables, fields, rows, and text accurately from the provided context.\n"
            )
            if ext in [".xlsx", ".csv"]:
                system_prompt += (
                    "Output a clean Markdown table with headers representing the columns and rows of data. "
                    "Ensure numerical values, dates, names, and categories are properly separated into distinct columns.\n"
                )
            else:
                system_prompt += (
                    "Format the content cleanly with clear Markdown headings (#, ##), bullet points, and structured sections.\n"
                )
                
            full_prompt = (
                f"{system_prompt}\n"
                f"----------------------------\nDOCUMENT & OCR CONTEXT:\n----------------------------\n{doc_ctx if doc_ctx else 'None'}\n\n"
                f"----------------------------\nCONVERSATION HISTORY:\n----------------------------\n{mem_ctx if mem_ctx else 'None'}\n\n"
                f"User Request: {question}\n\n"
                "AI Response:"
            )
            
            # Generate content using AI model
            ai_content = blocking_chat(full_prompt, model=data.model)
            if not ai_content or not ai_content.strip():
                ai_content = "No data extracted from document."
            
            # Generate actual file
            os.makedirs("uploads", exist_ok=True)
            fname = f"converted_{int(time.time())}{ext}"
            fpath = os.path.join("uploads", fname)
            
            try:
                if ext == ".xlsx":
                    generate_excel_report("Converted Document", ai_content, fpath)
                elif ext == ".docx":
                    generate_docx_report("Converted Document", ai_content, fpath)
                elif ext == ".pdf":
                    generate_pdf_report("Converted Document", ai_content, fpath)
                elif ext == ".csv":
                    generate_csv_report(ai_content, fpath)
                else:
                    generate_text_report("Converted Document", ai_content, fpath)
            except Exception as fe:
                print("File generation error:", fe)
                # Fallback to plain text
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(ai_content)
                
            file_url = f"{base_url_str}/uploads/{fname}"
            
            # Formulate response with live preview + direct download button
            response_md = (
                f"✅ **Conversion Complete!**\n\n"
                f"[📥 **Click to Download {file_type} ({ext.upper()})**]({file_url})\n\n"
                f"---\n\n"
                f"### 📋 Preview of Converted Content:\n\n"
                f"{ai_content}"
            )
            
            yield response_md
            
            # Save to DB
            ai_msg = Message(
                conversation_id=conv_id,
                role="assistant",
                content=response_md,
                parent_id=user_msg_id,
                branch_id=branch_id,
                is_deleted=False
            )
            db.add(ai_msg)
            increment_unread(db, conv_id)
            db.commit()
            
        return StreamingResponse(
            stream_file_generation(),
            media_type="text/plain",
            headers={"X-AI-Context": "{}"}
        )

    if query_type == "web_search":
        web_ctx = perform_web_search(question, max_results=4)
        
    # URL Detection & Scraping (Youtube & General Webpages)
    url_pattern = r"(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})"
    urls_found = re.findall(url_pattern, question)
    if urls_found:
        scraped = []
        for url in urls_found[:2]:
            scraped_content = scrape_url_context(url)
            if scraped_content:
                scraped.append(scraped_content)
        if scraped:
            web_ctx += "\n\n" + "\n\n".join(scraped)

    if query_type in ["admin", "general"]:
        target_user = extract_target_user(question)
        if target_user:
            feed_ctx = get_feed_context(db, target_user, question)
        else:
            feed_ctx = get_feed_context(db, username, question)

    if feed_ctx:
        matches = re.findall(r"Attached Document \[(.*?)\]", feed_ctx)
        if matches and os.path.exists("uploads"):
            for match in matches:
                match_clean = match.strip()
                if not match_clean: continue
                for f in os.listdir("uploads"):
                    if f.endswith(match_clean) or f == match_clean:
                        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                            img_path = os.path.join("uploads", f)
                            if img_path not in image_paths:
                                image_paths.append(img_path)

    print("\n------ CONTEXT DEBUG ------")
    print("INTENT:", query_type)
    print("DOC LOADED:", bool(doc_ctx), f"({len(doc_ctx)} chars)")
    print("FEED LOADED:", bool(feed_ctx))
    print("IMAGES LOADED:", len(image_paths))
    print("---------------------------\n")

    context_data = {
        "admin": feed_ctx,
        "document": doc_ctx,
        "memory": mem_ctx,
        "web": web_ctx
    }

    # =====================================================
    # PERSONA INJECTION
    # =====================================================
    persona_prompts = {
        "doctor": "You are a professional Medical Doctor AI. Provide accurate, empathetic, and evidence-based medical information.",
        "lawyer": "You are a professional Legal Counsel AI. Provide clear, logical, and structured legal analysis.",
        "coder": "You are an Expert Software Engineer AI. Provide clean, well-commented, and optimized code.",
        "teacher": "You are a patient and encouraging Educator AI. Break down complex topics so a beginner can understand them."
    }
    base_system = persona_prompts.get(data.persona, "You are an enterprise AI assistant with advanced OCR, document parsing, and multi-modal intelligence.")

    # =====================================================
    # PROMPT ENGINEERING & CONTEXT ISOLATION
    # =====================================================

    context_block = ""
    system_prompt = base_system

    if doc_ctx:
        system_prompt = (
            f"{base_system} You have direct access to the user's uploaded DOCUMENT & OCR CONTEXT. "
            "Accurately extract information, perform conversions, answer questions, analyze tables/receipts/invoices/forms, and calculate totals based on the context. "
            "When extracting tables or datasets, use clean Markdown tables. Cite document sections when appropriate."
        )
        context_block += f"----------------------------\nDOCUMENT & OCR CONTEXT\n----------------------------\n{doc_ctx}\n"

    if feed_ctx:
        context_block += f"----------------------------\nADMIN CONTEXT\n----------------------------\n{feed_ctx}\n"

    if web_ctx:
        context_block += f"----------------------------\nLIVE WEB SEARCH RESULTS\n----------------------------\n{web_ctx}\n"

    if not context_block.strip() and query_type == "casual":
        system_prompt = f"{base_system} Respond naturally, concisely, and politely."

    # =====================================================
    # PROMPT BUILDER
    # =====================================================

    prompt = f"""
{system_prompt}

CRITICAL RULE: You MUST answer ONLY the user's CURRENT question below. Do NOT reference, repeat, summarise, or carry over any documents, files, or analysis from previous conversation turns unless the user's current question specifically and explicitly asks about them.

{context_block}
----------------------------
CONVERSATION HISTORY (for tone/continuity only — do NOT repeat or re-summarise previous answers)
----------------------------
{mem_ctx if mem_ctx else "None"}

----------------------------
USER QUESTION — answer THIS and only THIS
----------------------------
{question}

----------------------------
AI ANSWER
----------------------------
"""

    # =====================================================
    # STREAM RESPONSE
    # =====================================================

    base64_images = []
    
    # HEURISTIC: Only use 5-10x slower LLaVA vision model if explicitly requested by visual keywords
    vision_keywords = ["look", "see", "visual", "vision", "describe image", "color", "graphic", "picture shows", "what's in this image"]
    requires_vision = any(w in question.lower() for w in vision_keywords)

    if image_paths and requires_vision:
        try:
            target_path = image_paths[0]
            if os.path.exists(target_path):
                with open(target_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("utf-8")
                    base64_images.append(b64)
        except Exception as e:
            print("Vision encoding error:", e)

    try:
        context_header = json.dumps(context_data)
    except:
        context_header = "{}"

    def stream_and_store():

        full_response = ""

        # Yield image preview only when image was specifically targeted or attached
        if image_paths and (requires_vision or query_type == "document"):
            target_path = image_paths[0]
            if os.path.exists(target_path):
                ext = os.path.splitext(target_path)[1].lower()
                if ext in [".png", ".jpg", ".jpeg", ".webp"]:
                    web_path = urllib.parse.quote(target_path.replace("\\", "/"), safe="/")
                    img_md = f"![Attached Image]({base_url_str}/{web_path})\n\n---\n\n"
                    full_response += img_md
                    yield img_md

        try:

            for chunk in chat_stream(prompt, model=data.model, images=base64_images if base64_images else None):

                if chunk:
                    full_response += chunk
                    yield chunk

        except Exception as e:

            print("Streaming Error:", e)
            yield "\n[Error generating response]"
            return

        if not full_response.strip():

            fallback = "No information found."
            full_response = fallback
            yield fallback

        ai_msg = Message(
            conversation_id=conv_id,
            role="assistant",
            content=full_response,
            parent_id=user_msg_id,
            branch_id=branch_id,
            is_deleted=False,
            context_metadata=context_header
        )

        db.add(ai_msg)
        increment_unread(db, conv_id)
        db.commit()

    return StreamingResponse(
        stream_and_store(),
        media_type="text/plain",
        headers={"X-AI-Context": context_header}
    )


# =========================================================
# EDIT MESSAGE
# =========================================================

@router.post("/edit")
def edit_message(data: EditRequest, db: Session = Depends(get_db)):

    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    branch_id = int(time.time())

    edited_msg = Message(
        conversation_id=data.conversation_id,
        role="user",
        content=data.content.strip(),
        parent_id=data.parent_id,
        branch_id=branch_id,
        is_deleted=False
    )

    db.add(edited_msg)
    db.commit()
    db.refresh(edited_msg)
    
    edited_msg_id = edited_msg.id

    mem_ctx = get_memory_context(db, data.conversation_id, branch_id)

    system_prompt = """
You are an AI assistant.

Continue the conversation clearly and logically.
"""

    prompt = f"""
{system_prompt}

Conversation History:
{mem_ctx}

User Question:
{data.content}

Answer:
"""

    def stream_and_store():

        full_response = ""

        for chunk in chat_stream(prompt):

            if chunk:
                full_response += chunk
                yield chunk

        if not full_response.strip():

            fallback = "No information found."
            full_response = fallback
            yield fallback

        ai_msg = Message(
            conversation_id=data.conversation_id,
            role="assistant",
            content=full_response,
            parent_id=edited_msg_id,
            branch_id=branch_id,
            is_deleted=False
        )

        db.add(ai_msg)
        increment_unread(db, data.conversation_id)
        db.commit()

    return StreamingResponse(stream_and_store(), media_type="text/plain")