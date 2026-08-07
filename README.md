# 🤖 RELEX AI — Enterprise AI Chat Platform

> A full-stack, production-ready AI chat application with RAG (Retrieval-Augmented Generation), document analysis, voice synthesis, admin broadcasting, and multi-model support.

![RELEX AI](./image.png)

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [Architecture](#-architecture)
4. [Backend Structure](#-backend-structure)
5. [Frontend Structure](#-frontend-structure)
6. [Core Features Explained](#-core-features-explained)
7. [Key Techniques & Concepts](#-key-techniques--concepts)
8. [API Endpoints](#-api-endpoints)
9. [Database Models](#-database-models)
10. [Environment Variables](#-environment-variables)
11. [Local Setup](#-local-setup)
12. [Free Cloud Deployment](#-free-cloud-deployment)

---

## 🌟 Project Overview

**RELEX AI** is an enterprise-grade AI chat platform that allows users to:
- Chat with multiple AI models (Llama, Mixtral, Gemma)
- Upload and analyze documents (PDF, DOCX, CSV, Excel, images)
- Receive admin-broadcast messages and policy documents
- Ask questions answered directly from uploaded files (RAG)
- Export conversations to PDF
- Share conversations via public links
- Use voice synthesis for AI answers

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose | Brief Explanation |
|-----------|---------|-------------------|
| **FastAPI** | Web framework | Python async web framework — handles HTTP routes, streaming responses, and file uploads |
| **SQLAlchemy** | ORM | Maps Python classes to database tables — no raw SQL needed |
| **SQLite / PostgreSQL** | Database | SQLite for local dev; PostgreSQL (Neon) for cloud production |
| **Groq API** | LLM provider | Cloud API that runs Llama, Mixtral, Gemma at high speed via GPU servers |
| **PyMuPDF (fitz)** | PDF parsing | Extracts text from PDF pages — handles both text PDFs and scanned (image-based) PDFs |
| **pypdf** | PDF reader | Secondary PDF parser for extracting selectable text |
| **python-docx** | DOCX parser | Reads Microsoft Word `.docx` files paragraph by paragraph |
| **pandas / openpyxl** | CSV/Excel parser | Loads spreadsheets into DataFrames for text extraction |
| **Pillow** | Image processing | Handles image reading and manipulation for OCR preprocessing |
| **numpy / scikit-learn** | Vector search | numpy arrays store document embeddings; cosine similarity finds relevant chunks |
| **passlib[bcrypt]** | Password hashing | Hashes passwords using the bcrypt algorithm — never stores plain text |
| **python-jose** | JWT tokens | Signs and verifies JSON Web Tokens for user authentication |
| **python-multipart** | File uploads | Parses `multipart/form-data` requests (file uploads) in FastAPI |
| **beautifulsoup4** | Web scraping | Parses HTML pages and extracts clean text for context |
| **duckduckgo-search** | Web search | Fetches live search results without requiring a paid API key |
| **yt-dlp** | YouTube processing | Downloads audio/transcripts from YouTube videos |
| **youtube-transcript-api** | Transcripts | Fetches auto-generated captions from YouTube videos |
| **httpx / requests** | HTTP client | Makes outbound HTTP requests to external APIs and websites |
| **python-dotenv** | Env vars | Loads variables from `.env` file into `os.environ` |
| **uvicorn** | ASGI server | Runs the FastAPI app — handles async requests efficiently |

### Frontend
| Technology | Purpose | Brief Explanation |
|-----------|---------|-------------------|
| **React 18** | UI framework | Component-based JavaScript library for building interactive UIs |
| **React Router** | Navigation | Handles client-side routing (`/login`, `/chat`, `/admin`) without page reloads |
| **Bootstrap 5** | CSS framework | Pre-built responsive grid and UI components |
| **Vanilla CSS** | Custom styling | Custom glassmorphism, dark mode, animations on top of Bootstrap |
| **Web Speech API** | Voice synthesis | Browser-native TTS (text-to-speech) — no external API needed |
| **Web Speech Recognition** | Voice input | Browser-native STT (speech-to-text) for microphone input |
| **marked.js** | Markdown renderer | Converts AI markdown responses (`**bold**`, `# heading`) into HTML |
| **localStorage** | Client storage | Persists user session, selected model, voice mode between page reloads |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    REACT FRONTEND                        │
│  Login → UserChat → ChatWindow → Sidebar → AdminDash    │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / Streaming (SSE)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                        │
│                                                          │
│  /auth  /chat  /upload  /admin  /export  /share         │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ RAG Svc  │  │ Groq API │  │  File Parser (OCR)   │  │
│  │ (numpy)  │  │ (LLM)    │  │  PDF/DOCX/CSV/Image  │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │             SQLite / PostgreSQL                  │   │
│  │  users | messages | conversations | feeds | docs │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Backend Structure

```
backend/
├── main.py                  # App entry point — registers routers, CORS, startup
├── database.py              # SQLAlchemy engine + session factory
├── models.py                # All database table definitions (ORM models)
├── schemas.py               # Pydantic request/response schemas
├── auth.py                  # JWT token creation and verification
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container definition for Railway/Koyeb deployment
│
├── routers/                 # Each file = one feature area
│   ├── auth_router.py       # Register, login, Google OAuth
│   ├── chat_router.py       # Main AI chat + streaming + intent detection
│   ├── upload_router.py     # File upload + text extraction + embeddings
│   ├── admin_feed_router.py # Admin broadcast messages + document feeds
│   ├── conversation_router.py # Create/list/archive/pin conversations
│   ├── message_router.py    # Fetch/delete messages
│   ├── prompt_router.py     # Save/load/delete prompt templates
│   ├── share_router.py      # Generate public share links for chats
│   ├── export_router.py     # Export chat to PDF
│   └── voice_router.py      # Voice/audio endpoints
│
└── services/                # Business logic separated from routes
    ├── rag_service.py        # Retrieval-Augmented Generation — fetches relevant document chunks
    ├── embedding_service.py  # Creates vector embeddings via Groq API
    ├── faiss_service.py      # In-memory vector store (numpy cosine similarity)
    ├── file_parser.py        # Parses PDF/DOCX/TXT/CSV/Excel/Image into text
    ├── ocr_service.py        # Optional EasyOCR for scanned image/PDF pages
    ├── ollama_service.py     # Routes requests to Groq Cloud or local Ollama
    ├── web_search_service.py # DuckDuckGo live web search
    ├── web_scraper_service.py# Scrapes webpage content + YouTube transcripts
    ├── audio_service.py      # Audio transcription (Whisper/yt-dlp)
    ├── video_service.py      # Video processing
    ├── doc_exporter.py       # Generates PDF export of conversations
    └── notification_service.py # WebSocket broadcast notifications
```

---

## 📁 Frontend Structure

```
frontend/src/
├── App.jsx                  # Root router — defines all page routes
├── index.css                # Global dark theme, glassmorphism, animations
│
├── pages/
│   ├── Login.jsx            # Login page with Google OAuth + local auth
│   ├── Signup.jsx           # Registration with username + password
│   ├── UserChat.jsx         # Main chat page wrapper (sidebar + chat window)
│   ├── AdminDashboard.jsx   # Admin control panel — users list, feed broadcaster
│   ├── AdminChat.jsx        # Admin's own chat interface
│   ├── ContextPage.jsx      # Shows what context (docs/feeds) AI is using
│   ├── SharedChatPage.jsx   # Public read-only shared conversation view
│   └── OAuthCallback.jsx    # Handles Google OAuth redirect and sets session
│
├── components/
│   ├── ChatWindow.jsx       # Core chat UI — messages, streaming, file upload, voice
│   ├── MessageBubble.jsx    # Single message renderer with markdown support
│   ├── Sidebar.jsx          # Conversation list, search, new chat
│   ├── ContextPanel.jsx     # Shows current AI context (doc chunks, feeds)
│   ├── NeuralBackground.jsx # Animated neural network canvas background
│   ├── PremiumBackground.jsx# Gradient animated background
│   ├── ParticleBackground.jsx # Particle animation background
│   └── CinematicOverlay.jsx # Loading overlay effect
│
└── services/
    ├── api.js               # All API calls (login, chat, upload, feeds, etc.)
    └── apiClient.js         # Base fetch wrapper — adds auth token + base URL
```

---

## ✨ Core Features Explained

### 1. 💬 AI Chat with Streaming
**What it does:** User sends a message → AI responds word-by-word in real time (like ChatGPT).

**How it works:**
- Frontend sends POST `/chat` with the message
- Backend calls Groq API with `stream=True`
- Backend yields each token chunk as it arrives
- FastAPI returns a `StreamingResponse` (text/plain)
- Frontend reads the stream using `response.body.getReader()` and accumulates chunks
- React state updates on every chunk → live typing effect in UI

### 2. 📄 Document Upload & RAG
**What it does:** User uploads a PDF/DOCX/CSV → can then ask questions about the file content.

**How it works (step by step):**
1. File is uploaded to `/upload` endpoint
2. Text is extracted using `file_parser.py` (PyMuPDF for PDF, python-docx for DOCX, pandas for CSV)
3. Text is split into small **chunks** (700 chars each, 150 char overlap)
4. Each chunk is sent to Groq's embedding API → returns a **vector** (list of 768 numbers)
5. Vectors are stored in the SQLite `document_embeddings` table
6. FAISS-like index (numpy array) is built in memory for fast search
7. When user asks a question, the question is also embedded into a vector
8. **Cosine similarity** compares the question vector to all stored chunk vectors
9. Top matching chunks are injected into the AI prompt as context

### 3. 🧠 RAG (Retrieval-Augmented Generation)
**Brief:** Instead of hoping the AI knows your document, we *give* it the relevant parts every time it answers.

**Cosine Similarity:** Measures the angle between two vectors. A score of 1.0 = identical meaning. Score near 0 = unrelated. → Used to find the most relevant document chunks for any question.

**Chunking:** Long documents are split into small overlapping pieces so each chunk fits within the LLM's context window limit.

**Embedding:** Converting text into a vector (array of numbers) where similar meanings produce similar vectors. Powered by Groq's `nomic-embed-text-v1.5` model.

### 4. 📢 Admin Feed System
**What it does:** Admin can broadcast messages or documents to all users or specific users. Users see them in their 💬 inbox.

**How it works:**
- Admin writes a message or uploads a document in the Admin Dashboard
- Backend saves it as an `AdminFeed` row with `target_user = "ALL"` or a specific username
- When users chat, the RAG service checks if relevant admin feeds exist
- Matching feeds are injected as context into the AI prompt
- Users can open their inbox panel and read all admin messages

### 5. 🎙 Voice Features
**Voice Output (TTS):** Uses browser's built-in `window.speechSynthesis` API.
- No external API needed — works 100% offline
- Supports 4 voice modes: Default, Female Young, Female Calm, Male Deep
- Each mode selects a specific system voice and adjusts pitch/rate

**Voice Input (STT):** Uses browser's `window.SpeechRecognition` API.
- Records microphone → converts speech to text in real time
- The transcribed text appears in the message input box

### 6. 🔐 Authentication
**JWT (JSON Web Token):**
- On login, server creates a signed token containing the user's ID and role
- Token is stored in `localStorage` on the frontend
- Every API request includes `Authorization: Bearer <token>` in the header
- Server verifies the token signature before processing any request

**bcrypt Password Hashing:**
- Passwords are never stored plain — they are run through bcrypt
- bcrypt adds a random "salt" before hashing, making rainbow table attacks impossible
- On login, bcrypt compares the submitted password to the stored hash

**Google OAuth:**
- User clicks "Sign in with Google" → redirected to Google's auth page
- Google redirects back to `/oauth-callback` with a code
- Backend exchanges the code for user info → creates/finds the user account

### 7. 📊 Intent Classification
**What it does:** Classifies each user message into a type so the right context is loaded.

| Type | Triggers | AI Behaviour |
|------|---------|-------------|
| `casual` | hi, hello, thanks | No context loaded — chat naturally |
| `admin` | "my salary", "company policy" | Load admin feed context |
| `document` | "pdf", "upload", "resume" | Load RAG document context |
| `web_search` | "latest news", "today" | Perform live web search |
| `generation` | "draw", "create image of" | Generate image via Pollinations API |
| `file_generation` | "create excel", "generate csv" | AI creates a downloadable file |
| `general` | Everything else | Load both feed + document context |

### 8. 🖼 Image Generation
**What it does:** User says "draw a cat" → AI generates an image.
- Uses [Pollinations.ai](https://pollinations.ai) API (free, no key needed)
- The user's text is cleaned and encoded into a URL
- Backend fetches the image, saves it to `uploads/`, returns a markdown image link
- Frontend renders the image inline in the chat

### 9. 🔗 Share Conversations
**What it does:** Creates a public, read-only link for any conversation.
- Backend generates a UUID and saves it with the conversation ID
- Anyone with the link can view the chat at `/share/<uuid>`
- No login required to view shared chats

### 10. 📥 Prompt Library
**What it does:** Users can save frequently used prompts and reuse them.
- Prompts are stored in `prompt_templates` table linked to the user's ID
- Clicking a saved prompt inserts it directly into the message input

---

## 🔗 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/auth/register` | Create new user account |
| POST | `/auth/login` | Login with username + password → returns JWT |
| GET | `/auth/google` | Start Google OAuth flow |
| GET | `/auth/google/callback` | Handle Google OAuth redirect |

### Chat
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/chat` | Send message → streaming AI response |
| GET | `/models` | List available AI models |

### Conversations
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/conversations` | Create new conversation |
| GET | `/conversations/{user_id}` | List user's conversations |
| DELETE | `/conversations/{id}` | Delete conversation |
| PUT | `/conversations/{id}/pin` | Pin/unpin conversation |
| PUT | `/conversations/{id}/archive` | Archive conversation |

### Upload & Documents
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/upload` | Upload file → extract text → create embeddings |
| GET | `/uploads/{filename}` | Serve uploaded files |

### Admin Feeds
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/admin/feed` | Create text broadcast message |
| POST | `/admin/feed-document` | Create document feed (parsed + stored) |
| GET | `/admin/feeds` | Get all feeds (admin view) |
| GET | `/admin/user-feeds/{username}` | Get feeds for a specific user |
| POST | `/admin/mark-feed-viewed/{id}/{username}` | Mark feed as read |
| DELETE | `/admin/feed/{id}` | Delete a feed |

### Prompts
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/prompts/{user_id}` | Get user's saved prompts |
| POST | `/prompts` | Save a new prompt |
| DELETE | `/prompts/{id}` | Delete a prompt |

### Export & Share
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/export/pdf` | Export conversation as PDF |
| POST | `/share/{conversation_id}` | Create shareable link |
| GET | `/share/{uuid}` | Retrieve shared conversation |

---

## 🗄 Database Models

### `User`
Stores registered users.
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `username` | String | Unique login name |
| `password` | String | bcrypt hashed password |
| `role` | String | `"user"` or `"admin"` |
| `is_online` | Boolean | Live online status |
| `created_at` | DateTime | Registration timestamp |

### `Conversation`
Groups messages into chat sessions.
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `user_id` | Integer | Owner user ID |
| `title` | String | Auto-generated from first message |
| `is_pinned` | Boolean | Pinned to sidebar top |
| `is_archived` | Boolean | Hidden from main list |

### `Message`
Individual chat messages.
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `conversation_id` | Integer | Parent conversation |
| `role` | String | `"user"` or `"assistant"` |
| `content` | Text | The message text |
| `context_metadata` | Text | JSON — what context AI used (for ContextPanel) |

### `DocumentEmbedding`
Stores chunked text + vectors for RAG.
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `content` | Text | The text chunk |
| `embedding` | Text | JSON array of float numbers (the vector) |
| `filename` | String | Source file name |
| `conversation_id` | Integer | Isolates docs per conversation |

### `AdminFeed`
Admin broadcast messages visible in user inbox.
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `title` | String | Feed subject |
| `content` | Text | Message body (may include parsed document text) |
| `target_user` | String | `"ALL"` or specific username |
| `created_by` | String | Admin who created it |
| `viewed_by` | Text | JSON list of usernames who read it |

### `PromptTemplate`
Saved prompt library entries.
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `user_id` | Integer | Owner |
| `title` | String | Prompt label |
| `content` | Text | The prompt text |

### `SharedChat`
Public share links for conversations.
| Column | Type | Description |
|--------|------|-------------|
| `uuid` | String | Public URL token (primary key) |
| `conversation_id` | Integer | The conversation being shared |
| `expires_at` | DateTime | Optional expiry |

---

## 🔑 Environment Variables

Create `backend/.env`:
```env
# Groq Cloud API key (free at console.groq.com)
GROQ_API_KEY=gsk_your_key_here

# PostgreSQL for production — leave empty to use local SQLite
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb

# JWT secret (any random 32+ character string)
SECRET_KEY=your-super-secret-key-change-this

# Google OAuth (optional — only needed for Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Create `frontend/.env.production`:
```env
# Your deployed backend URL
REACT_APP_API_URL=https://your-backend.up.railway.app
```

---

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Backend Setup
```bash
# 1. Navigate to backend
cd "RELEX AI/backend"

# 2. Create virtual environment
python -m venv venv

# 3. Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Copy and configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# 6. Start backend
uvicorn main:app --reload --port 8000

# API docs available at: http://localhost:8000/docs
```

### Frontend Setup
```bash
# 1. Navigate to frontend
cd "RELEX AI/frontend"

# 2. Install dependencies
npm install

# 3. Start dev server
npm start

# App opens at: http://localhost:3000
```

---

## ☁ Free Cloud Deployment

### Best Free Stack (No Render / No Vercel)

| Layer | Service | URL |
|-------|---------|-----|
| Backend | **Railway** | [railway.app](https://railway.app) — $5 free credit/month |
| Frontend | **Netlify** | [netlify.com](https://netlify.com) — 100 GB/month free |
| Database | **Neon** | [neon.tech](https://neon.tech) — 512 MB PostgreSQL free forever |

### Quick Deploy Steps

**1. Database (Neon) — 2 min**
- Sign up at neon.tech → Create project → Copy connection string

**2. Backend (Railway) — 5 min**
- Sign up at railway.app → New Project → Deploy from GitHub
- Set Root Directory to `backend`
- Add env vars: `GROQ_API_KEY`, `DATABASE_URL`

**3. Frontend (Netlify) — 3 min**
- Sign up at netlify.com → Import from Git
- Base directory: `frontend`, Build command: `npm run build`
- Add env var: `REACT_APP_API_URL=https://your-app.up.railway.app`

### Alternative: Koyeb (Always-On, No Cold Starts)
- [koyeb.com](https://www.koyeb.com) → Free nano instance (512 MB) that never sleeps
- Connect GitHub → Root dir: `backend` → Add env vars → Deploy

---

## 📜 License

MIT License — see [LICENSE](./LICENSE)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

*Built with ❤️ using FastAPI, React, Groq, and modern AI techniques.*