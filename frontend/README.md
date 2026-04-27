# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
# RELEX AI

**RELEX AI** is an enterprise AI assistant designed to provide accurate, context-aware responses inside an organization.
It integrates **Admin Context (employee information), Document Retrieval (RAG), and Conversation Memory** to deliver reliable answers using Large Language Models.

The system combines **FastAPI, React, SQLite, FAISS, and Ollama** to create a full-stack AI platform capable of intelligent knowledge retrieval and conversational assistance.

---

## Key Features

* **Enterprise AI Chatbot**

  * Interactive chat interface with streaming responses.

* **Admin Feed Context**

  * Admins can push employee-specific information such as salary, announcements, or leave policies.

* **Document Retrieval (RAG)**

  * Upload documents (PDF / text) and query them using semantic search.

* **Conversation Memory**

  * Maintains chat history to provide conversational continuity.

* **Secure Role System**

  * Separate **User Interface** and **Admin Dashboard**.

* **AI Context Viewer**

  * Displays the context sources used by the AI response.

---

## System Architecture

```
User Query
    │
    ▼
Context Retrieval Layer
 ├─ Admin Feed Context
 ├─ Document RAG (FAISS)
 └─ Conversation Memory
    │
    ▼
Prompt Builder
    │
    ▼
LLM Engine (Ollama)
    │
    ▼
Streaming AI Response
```

---

## Tech Stack

### Frontend

* React
* Bootstrap / CSS
* React Router

### Backend

* FastAPI
* SQLAlchemy
* SQLite

### AI / Data

* Ollama (LLM inference)
* FAISS (vector search)
* Embedding models

---

## Project Structure

```
RELEX-AI
│
├── backend
│   ├── routers
│   ├── services
│   ├── models.py
│   ├── database.py
│   └── main.py
│
├── frontend
│   ├── components
│   ├── pages
│   ├── services
│   └── App.jsx
│
├── uploads
├── embeddings
└── README.md
```

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/relex-ai.git
cd relex-ai
```

---

### 2. Backend Setup

```bash
cd backend

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt
```

Run backend:

```bash
uvicorn main:app --reload
```

Backend runs on:

```
http://localhost:8000
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on:

```
http://localhost:3000
```

---

## AI Model Setup

Install Ollama and run a model:

```
ollama run llama3
```

Then configure the backend to use Ollama for inference.

---

## Admin Dashboard

Admins can:

* Send organization announcements
* Assign feeds to specific users
* Manage employee context
* Monitor AI responses

---

## Future Improvements

* Multi-tenant enterprise support
* Authentication with JWT / OAuth
* Vector database (Pinecone / Weaviate)
* Production deployment
* Advanced RAG pipeline

---

## Author

**Chidanand M**

Full-stack developer focused on building enterprise AI applications.

---

## License

This project is licensed under the MIT License.
