import { useState, useEffect, useRef, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import { sendMessage, getMessages, createConversation, getAvailableModels, getPrompts, createPrompt, deletePrompt, generateShareLink, getUserFeeds, markFeedViewed } from "../services/api";
import { useNavigate } from "react-router-dom";

/**
 * ChatWindow
 * Props:
 *  - user
 *  - conversationId
 *  - setContextData (NEW)
 */
const DEFAULT_MODELS = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    badge: "🧠 High Accuracy",
    description: "GPT-4 level deep reasoning, highest accuracy for complex Q&A & document analysis"
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B",
    badge: "⚡ Ultra Fast",
    description: "Lightning-fast responses for everyday conversations and quick answers"
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    badge: "🔬 Deep Logic",
    description: "32k context window with strong multi-step logic and technical analysis"
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B",
    badge: "💎 Balanced",
    description: "Google's high-efficiency model balancing speed and nuanced understanding"
  }
];

export default function ChatWindow({ user, conversationId, setContextData, onConversationCreated, onOpenProfile }) {

  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [hasMore, setHasMore] = useState(true);
  const [loadingOld, setLoadingOld] = useState(false);

  // ============================
  // MODEL SELECTOR STATE
  // ============================
  const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem("selected_model") || "llama-3.3-70b-versatile";
  });
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // ============================
  // PERSONA SELECTOR STATE
  // ============================
  const PERSONAS = [
    { id: "default", icon: "🤖", label: "Default AI" },
    { id: "doctor", icon: "🩺", label: "Doctor" },
    { id: "lawyer", icon: "⚖️", label: "Lawyer" },
    { id: "coder", icon: "💻", label: "Coder" },
    { id: "teacher", icon: "📚", label: "Teacher" }
  ];
  const [selectedPersona, setSelectedPersona] = useState(() => {
    return localStorage.getItem("selected_persona") || "default";
  });
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);

  // ============================
  // PROMPTS STATE
  // ============================
  const [prompts, setPrompts] = useState([]);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [shareToast, setShareToast] = useState(null);

  // ============================
  // INBOX (ADMIN FEEDS) STATE
  // ============================
  const [showInbox, setShowInbox] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [unreadFeeds, setUnreadFeeds] = useState(0);

  const loadFeeds = async () => {
    try {
      if (user && user.username) {
        const data = await getUserFeeds(user.username);
        const feedList = Array.isArray(data) ? data : [];
        setFeeds(feedList);
        setUnreadFeeds(feedList.filter(f => !f.viewed).length);
      }
    } catch (e) {
      console.log("Failed to load feeds", e);
    }
  };

  useEffect(() => {
    loadFeeds();
    const interval = setInterval(loadFeeds, 30000); // Poll every 30s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleOpenInbox = async () => {
    setShowInbox(true);
    // Mark all as viewed
    const unviewed = feeds.filter(f => !f.viewed);
    for (const feed of unviewed) {
      try {
        await markFeedViewed(feed.id, user.username);
      } catch (e) {}
    }
    setUnreadFeeds(0);
    setFeeds(prev => prev.map(f => ({ ...f, viewed: true })));
  };

  const loadPrompts = async () => {
    try {
      if (user && user.id) {
        const data = await getPrompts(user.id);
        setPrompts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.log("Failed to load prompts", e);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPrompts();
  }, [user]);

  const handleSavePrompt = async () => {
    if (!input.trim() || !newPromptTitle.trim()) return;
    try {
      await createPrompt({ user_id: user.id, title: newPromptTitle, content: input });
      setNewPromptTitle("");
      loadPrompts();
    } catch (e) {
      alert("Failed to save prompt");
    }
  };

  const handleDeletePrompt = async (id) => {
    try {
      await deletePrompt(id);
      loadPrompts();
    } catch (e) {
      alert("Failed to delete prompt");
    }
  };

  useEffect(() => {
    getAvailableModels()
      .then((res) => {
        if (res && res.models && res.models.length > 0) {
          setAvailableModels(res.models);
        }
      })
      .catch((err) => console.log("Using default models registry:", err));
  }, []);

  const currentModelObj = availableModels.find((m) => m.id === selectedModel) || availableModels[0];

  // ============================
  // VOICE & PDF INTERACTION HELPERS
  // ============================
  const [activeSpeakId, setActiveSpeakId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const toggleSpeakText = (id, text) => {
    if (activeSpeakId === id) {
      window.speechSynthesis.cancel();
      setActiveSpeakId(null);
    } else {
      window.speechSynthesis.cancel();
      // Remove inline citation brackets [filename.pdf #Chunk X] for smooth text dictation
      const cleanText = text.replace(/\[.*?\]/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.onend = () => setActiveSpeakId(null);
      utterance.onerror = () => setActiveSpeakId(null);
      window.speechSynthesis.speak(utterance);
      setActiveSpeakId(id);
    }
  };

  const toggleRecording = () => {
    // Stop if already recording
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onstart = () => {
      console.log("🎙️ Speech recognition started");
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
      // Show live transcription as user speaks
      setInput(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow microphone permission in your browser settings.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log("🎙️ Speech recognition ended");
      setIsRecording(false);
      // Keep the final transcript in the input
      if (finalTranscript.trim()) {
        setInput(finalTranscript.trim());
      }
    };

    recognition.start();
  };

  const exportPdfReport = async () => {
    if (messages.length === 0) return;
    const textTranscript = messages.map(m => {
      const roleName = m.role === "user" ? "USER" : "RELEX AI ASSISTANT";
      return `${roleName}:\n${m.content}\n\n`;
    }).join("\n");
    
    try {
      const res = await fetch("http://localhost:8000/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `RELEX AI Chat Report - Conversation #${conversationId || 'New'}`,
          content: textTranscript
        })
      });
      const data = await res.json();
      if (data.ok && data.pdf_url) {
        window.open(data.pdf_url, "_blank");
      } else {
        alert("Failed to export PDF: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Error printing PDF document: " + err.message);
    }
  };

  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // ============================
  // Normalize getMessages result
  // ============================
  const normalizeMessagesResult = async (resOrData) => {
    if (!resOrData) return [];

    if (typeof resOrData.json === "function" && typeof resOrData.ok !== "undefined") {
      try {
        if (!resOrData.ok) {
          const txt = await resOrData.text();
          console.error("getMessages failed:", txt);
          return [];
        }
        return await resOrData.json();
      } catch (e) {
        console.error("Failed to parse getMessages:", e);
        return [];
      }
    }

    return Array.isArray(resOrData) ? resOrData : [];
  };

  // ============================
  // Load messages
  // ============================
  const loadMessages = useCallback(
    async (reset = false) => {
      if (!conversationId) return;

      const useOffset = reset ? 0 : offset;

      if (!reset) setLoadingOld(true);

      try {
        const res = await getMessages(conversationId, useOffset, limit);
        const data = await normalizeMessagesResult(res);

        if (reset) {
          setMessages(data);
          setOffset(data.length >= limit ? limit : data.length);
          setHasMore(data.length >= limit);

          // Update context data from the latest assistant message
          const assistantMsgs = data.filter(m => m.role === "assistant" && m.context_metadata);
          if (assistantMsgs.length > 0) {
            const latest = assistantMsgs[assistantMsgs.length - 1];
            try {
              const parsed = JSON.parse(latest.context_metadata);
              localStorage.setItem("ai_context", latest.context_metadata);
              if (typeof setContextData === "function") {
                setContextData(parsed);
              }
            } catch (err) {
              console.error("Error parsing message context metadata:", err);
            }
          } else {
            localStorage.removeItem("ai_context");
            if (typeof setContextData === "function") {
              setContextData(null);
            }
          }
        } else {
          setMessages((prev) => [...data, ...prev]);
          setOffset((prev) => prev + data.length);
          if (data.length < limit) setHasMore(false);
        }
      } catch (err) {
        console.error("loadMessages error:", err);
      } finally {
        setLoadingOld(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId]
  );

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);

    if (!conversationId) return;

    loadMessages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ============================
  // Infinite scroll
  // ============================
  const loadOlder = async () => {

    if (!conversationId || !hasMore || loadingOld) return;

    const el = containerRef.current;
    const oldHeight = el ? el.scrollHeight : 0;

    await loadMessages(false);

    setTimeout(() => {
      if (!el) return;
      el.scrollTop = el.scrollHeight - oldHeight;
    }, 0);
  };

  const handleScroll = async (e) => {
    if (e.target.scrollTop === 0 && hasMore && !loadingOld) {
      await loadOlder();
    }
  };

  // ============================
  // SEND MESSAGE
  // ============================
  const send = async () => {

    let targetConvId = conversationId;

    if (!targetConvId) {
       try {
         const newConv = await createConversation({
           user_id: user.id,
           title: input.slice(0, 30) || "New Chat"
         });
         if (newConv && newConv.id) {
            targetConvId = newConv.id;
            if (onConversationCreated) {
               onConversationCreated(targetConvId);
            }
         } else {
            return;
         }
       } catch (e) {
         console.error("Failed to create conversation", e);
         return;
       }
    }

    if (!input.trim() || isStreamingRef.current) return;

    isStreamingRef.current = true;
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {

      const res = await sendMessage({
        username: user.username,
        conversation_id: targetConvId,
        message: input,
        model: selectedModel,
        persona: selectedPersona
      }, abortControllerRef.current.signal);

      // ============================
      // READ CONTEXT HEADER
      // ============================
      // ============================
// READ CONTEXT HEADER
// ============================

const ctxHeader = res.headers.get("X-AI-Context");

if (ctxHeader) {
  try {

    const parsed = JSON.parse(ctxHeader);

    // update state for live UI
    if (setContextData) {
      setContextData(parsed);
    }

    // store for ContextPage
    localStorage.setItem("ai_context", ctxHeader);

  } catch (e) {
    console.error("Context parse error:", e);
  }
}

      let responseObj = res;

      if (!responseObj || typeof responseObj.body === "undefined") {

        const data = res && typeof res.then === "function" ? await res : res;
        const assistantText = data?.assistant || data?.message || "";

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText
          };
          return updated;
        });

        setInput("");
        isStreamingRef.current = false;
        return;
      }

      if (!responseObj.ok) {
        const txt = await responseObj.text();
        console.error("Chat failed:", txt);
        alert("Chat failed");
        isStreamingRef.current = false;
        return;
      }

      const reader = responseObj.body.getReader();
      const decoder = new TextDecoder();

      let accumulated = "";

      while (true) {

        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        accumulated += chunkText;

        const currentText = accumulated;

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: currentText,
            isStreaming: true
          };
          return updated;
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: accumulated,
          isStreaming: false
        };
        return updated;
      });

      setInput("");

    } catch (err) {

      if (err.name === "AbortError") {
        console.log("Streaming aborted");
      } else {
        console.error("Streaming error:", err);
        alert("Model is not responding");
      }

    } finally {

      isStreamingRef.current = false;
      setIsGenerating(false);
      abortControllerRef.current = null;

      // Force React UI tree reconciliation to remove stop button and streaming cursors
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === "assistant" && updated[lastIndex].isStreaming) {
          updated[lastIndex] = { ...updated[lastIndex], isStreaming: false };
        }
        return updated;
      });

    }
  };

  // ============================
  // STOP STREAM
  // ============================
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e) => {

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }

  };

  // ============================
  // AUTO SCROLL
  // ============================
  useEffect(() => {

    const el = containerRef.current;
    if (!el) return;

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (nearBottom && localStorage.getItem('autoScroll') !== 'false') {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

  }, [messages]);

  // ============================
  // FILE UPLOAD
  // ============================
  const handleUpload = async (e) => {

    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    let targetConvId = conversationId;

    if (!targetConvId) {
      try {
        const newConv = await createConversation({
          user_id: user.id,
          title: `File: ${file.name.slice(0, 20)}`
        });
        if (newConv && newConv.id) {
          targetConvId = newConv.id;
          if (onConversationCreated) {
            onConversationCreated(targetConvId);
          }
        } else {
          setIsUploading(false);
          return;
        }
      } catch (err) {
        console.error("Failed to create conversation for upload", err);
        setIsUploading(false);
        return;
      }
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversation_id", targetConvId);

    try {

      const res = await fetch((process.env.REACT_APP_API_URL || "http://localhost:8000") + "/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Upload failed:", txt);
        alert("Upload failed");
        return;
      }

      await res.json().catch(() => null);
      
      // Inject synthetic success message into chat stream instantly just like ChatGPT
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `✅ **System Notice:** The file \`${file.name}\` has been successfully uploaded, processed, and embedded into the RAG context. I am ready to answer questions about it!`,
        isStreaming: false
      }]);

    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    } finally {
      setIsUploading(false);
      // Reset input value so same file can be uploaded again if needed
      e.target.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ============================
  // UI
  // ============================
  return (
    <div className="d-flex flex-column vh-100 chat-window glass-main">

      {/* Top Header with Model Picker */}
      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom glass-header position-relative" style={{ zIndex: 100 }}>
        <div className="position-relative">
          <button
            className="btn btn-sm d-flex align-items-center gap-2 model-selector-btn"
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              borderRadius: "12px",
              padding: "6px 14px",
              fontWeight: "600",
              fontSize: "0.88rem",
              backdropFilter: "blur(10px)"
            }}
          >
            <span className="badge px-2 py-1 rounded-pill" style={{ fontSize: "0.72rem", background: "rgba(0, 210, 255, 0.15)", color: "#00d2ff", border: "1px solid rgba(0, 210, 255, 0.3)" }}>
              {currentModelObj.badge}
            </span>
            <span className="fw-bold text-light" style={{ fontSize: "0.92rem" }}>
              {currentModelObj.name}
            </span>
            <span className="text-muted" style={{ fontSize: "0.7rem", transition: "transform 0.2s ease", transform: showModelDropdown ? "rotate(180deg)" : "rotate(0deg)" }}>
              ▼
            </span>
          </button>

          {/* Glassmorphic Dropdown Menu */}
          {showModelDropdown && (
            <>
              <div 
                className="position-fixed top-0 start-0 w-100 h-100" 
                style={{ zIndex: 998 }} 
                onClick={() => setShowModelDropdown(false)} 
              />
              <div
                className="position-absolute top-100 start-0 mt-2 shadow-lg glass-dropdown-menu"
                style={{
                  width: "340px",
                  zIndex: 999,
                  background: "rgba(18, 17, 28, 0.95)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "16px",
                  padding: "12px",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
                }}
              >
                <div className="px-2 py-1 mb-2 border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                  <span className="text-uppercase text-muted fw-bold" style={{ fontSize: "0.7rem", letterSpacing: "1px" }}>
                    Select AI Model
                  </span>
                </div>

                {/* Group: Cloud Models */}
                {(() => {
                  const cloudModels = availableModels.filter(m => m.provider === "groq" || !m.provider);
                  const localModels = availableModels.filter(m => m.provider === "ollama");

                  const renderModelItem = (m) => {
                    const isSelected = selectedModel === m.id;
                    const isLocal = m.provider === "ollama";
                    return (
                      <div
                        key={m.id}
                        className={`p-2 mb-2 rounded-3 cursor-pointer model-option-item ${isSelected ? "active-model-item" : ""}`}
                        style={{
                          background: isSelected
                            ? (isLocal ? "rgba(52, 211, 153, 0.12)" : "rgba(0, 210, 255, 0.12)")
                            : "rgba(255, 255, 255, 0.03)",
                          border: isSelected
                            ? (isLocal ? "1px solid rgba(52, 211, 153, 0.4)" : "1px solid rgba(0, 210, 255, 0.4)")
                            : "1px solid rgba(255, 255, 255, 0.06)",
                          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                          borderRadius: "12px"
                        }}
                        onClick={() => {
                          setSelectedModel(m.id);
                          localStorage.setItem("selected_model", m.id);
                          setShowModelDropdown(false);
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="fw-bold text-light" style={{ fontSize: "0.88rem" }}>
                            {m.name}
                          </span>
                          <span className="badge rounded-pill" style={{
                            fontSize: "0.68rem",
                            background: isSelected
                              ? (isLocal ? "rgba(52, 211, 153, 0.25)" : "rgba(0, 210, 255, 0.25)")
                              : "rgba(255, 255, 255, 0.08)",
                            color: isSelected
                              ? (isLocal ? "#34d399" : "#00d2ff")
                              : "#cbd5e1",
                            border: isSelected
                              ? (isLocal ? "1px solid rgba(52, 211, 153, 0.5)" : "1px solid rgba(0, 210, 255, 0.5)")
                              : "1px solid rgba(255, 255, 255, 0.1)"
                          }}>
                            {m.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.74rem", lineHeight: "1.35", color: "#94a3b8" }}>
                          {m.description}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {/* Cloud Section */}
                      {cloudModels.length > 0 && (
                        <>
                          <div className="d-flex align-items-center gap-2 mb-2 mt-1">
                            <div style={{ flex: 1, height: "1px", background: "rgba(0, 210, 255, 0.15)" }} />
                            <span style={{ fontSize: "0.67rem", fontWeight: "700", letterSpacing: "0.8px", color: "#00d2ff", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                              ☁️ Groq Cloud
                            </span>
                            <div style={{ flex: 1, height: "1px", background: "rgba(0, 210, 255, 0.15)" }} />
                          </div>
                          {cloudModels.map(renderModelItem)}
                        </>
                      )}

                      {/* Local Ollama Section */}
                      {localModels.length > 0 && (
                        <>
                          <div className="d-flex align-items-center gap-2 mb-2 mt-3">
                            <div style={{ flex: 1, height: "1px", background: "rgba(52, 211, 153, 0.15)" }} />
                            <span style={{ fontSize: "0.67rem", fontWeight: "700", letterSpacing: "0.8px", color: "#34d399", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                              💻 Local Ollama
                            </span>
                            <div style={{ flex: 1, height: "1px", background: "rgba(52, 211, 153, 0.15)" }} />
                          </div>
                          {localModels.map(renderModelItem)}
                        </>
                      )}

                      {localModels.length === 0 && (
                        <div className="text-center py-2 px-3 rounded-3 mt-2" style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px dashed rgba(255, 255, 255, 0.08)",
                          borderRadius: "10px"
                        }}>
                          <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                            💻 <span style={{ color: "#475569" }}>Ollama offline or no local models found.</span>
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#374151", marginTop: "3px" }}>
                            Run <code style={{ color: "#6b7280" }}>ollama serve</code> to enable local models.
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* Persona Picker */}
        <div className="position-relative">
          <button
            className="btn btn-sm d-flex align-items-center gap-2 model-selector-btn"
            onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              borderRadius: "12px",
              padding: "6px 14px",
              fontWeight: "600",
              fontSize: "0.88rem",
              backdropFilter: "blur(10px)"
            }}
          >
            <span>{PERSONAS.find(p => p.id === selectedPersona)?.icon}</span>
            <span className="fw-bold text-light" style={{ fontSize: "0.92rem" }}>
              {PERSONAS.find(p => p.id === selectedPersona)?.label}
            </span>
            <span className="text-muted" style={{ fontSize: "0.7rem", transition: "transform 0.2s ease", transform: showPersonaDropdown ? "rotate(180deg)" : "rotate(0deg)" }}>
              ▼
            </span>
          </button>

          {showPersonaDropdown && (
            <>
              <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 998 }} onClick={() => setShowPersonaDropdown(false)} />
              <div
                className="position-absolute top-100 start-0 mt-2 shadow-lg glass-dropdown-menu"
                style={{
                  width: "200px", zIndex: 999, background: "rgba(18, 17, 28, 0.95)",
                  backdropFilter: "blur(20px)", border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "16px", padding: "12px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
                }}
              >
                <div className="px-2 py-1 mb-2 border-bottom border-secondary border-opacity-25 text-uppercase text-muted fw-bold" style={{ fontSize: "0.7rem", letterSpacing: "1px" }}>
                  Select Persona
                </div>
                {PERSONAS.map(p => {
                  const isSelected = selectedPersona === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-2 mb-2 rounded-3 cursor-pointer model-option-item ${isSelected ? "active-model-item" : ""}`}
                      style={{
                        background: isSelected ? "rgba(167, 139, 250, 0.12)" : "rgba(255, 255, 255, 0.03)",
                        border: isSelected ? "1px solid rgba(167, 139, 250, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: "10px"
                      }}
                      onClick={() => {
                        setSelectedPersona(p.id);
                        localStorage.setItem("selected_persona", p.id);
                        setShowPersonaDropdown(false);
                      }}
                    >
                      <span className="me-2">{p.icon}</span>
                      <span style={{ fontSize: "0.85rem", color: isSelected ? "#a78bfa" : "#fff", fontWeight: isSelected ? "bold" : "normal" }}>{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Share Button — Native Web Share API */}
          {conversationId && (
            <button
              className="btn btn-sm d-flex align-items-center gap-1"
              onClick={async () => {
                try {
                  const data = await generateShareLink(conversationId);
                  const shareUrl = `${window.location.origin}/share/${data.uuid}`;
                  const shareData = {
                    title: "RELEX AI Conversation",
                    text: "Check out this AI conversation on RELEX AI!",
                    url: shareUrl,
                  };
                  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                  } else {
                    // Fallback: copy to clipboard and show a styled toast
                    await navigator.clipboard.writeText(shareUrl);
                    setShareToast(shareUrl);
                    setTimeout(() => setShareToast(null), 4000);
                  }
                } catch (e) {
                  if (e.name !== "AbortError") {
                    console.error("Share failed:", e);
                  }
                }
              }}
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "10px",
                fontSize: "0.75rem",
                fontWeight: "600"
              }}
            >
              🔗 Share
            </button>
          )}

          {/* Messages / Inbox Button */}
          <button
            className="btn btn-sm d-flex align-items-center gap-1 position-relative"
            onClick={handleOpenInbox}
            style={{
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: "600"
            }}
          >
            💬 {feeds.length > 0 ? `${feeds.length} messages` : "Messages"}
            {unreadFeeds > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{ background: "#ef4444", fontSize: "0.6rem", minWidth: "18px" }}
              >
                {unreadFeeds}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Share fallback toast */}
      {shareToast && (
        <div
          style={{
            position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
            background: "rgba(16, 185, 129, 0.95)", color: "#fff", padding: "10px 20px",
            borderRadius: "12px", zIndex: 2000, fontSize: "0.85rem", fontWeight: "600",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)", backdropFilter: "blur(10px)"
          }}
        >
          ✅ Link copied! <span style={{ opacity: 0.8, fontWeight: 400, wordBreak: "break-all" }}>{shareToast}</span>
        </div>
      )}

      {/* Inbox / Messages Panel */}
      {showInbox && (
        <div
          className="position-fixed top-0 end-0 h-100"
          style={{ width: "360px", zIndex: 1060, background: "rgba(12, 11, 22, 0.97)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", boxShadow: "-10px 0 40px rgba(0,0,0,0.5)", animation: "slideInRight 0.25s ease" }}
        >
          <div className="d-flex align-items-center justify-content-between p-3 border-bottom border-light border-opacity-10">
            <div>
              <h6 className="mb-0 fw-bold text-light">💬 Messages</h6>
              <small className="text-muted">Admin broadcasts & notifications</small>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowInbox(false)}>✕</button>
          </div>

          <div className="flex-grow-1 overflow-auto p-3" style={{ overscrollBehavior: "contain" }}>
            {feeds.length === 0 ? (
              <div className="text-center py-5">
                <div style={{ fontSize: "3rem" }}>📭</div>
                <p className="text-muted mt-2">No messages yet.</p>
                <small className="text-muted">Admin messages and broadcasts will appear here.</small>
              </div>
            ) : (
              feeds.map(feed => (
                <div
                  key={feed.id}
                  className="p-3 mb-3 rounded-3"
                  style={{
                    background: feed.viewed ? "rgba(255,255,255,0.03)" : "rgba(99, 102, 241, 0.1)",
                    border: feed.viewed ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(99, 102, 241, 0.4)",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="fw-bold text-light" style={{ fontSize: "0.85rem" }}>
                      {!feed.viewed && <span className="me-1" style={{ color: "#818cf8" }}>●</span>}
                      {feed.title || "Admin Message"}
                    </span>
                    <small className="text-muted" style={{ fontSize: "0.7rem" }}>
                      {feed.created_at ? new Date(feed.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </small>
                  </div>
                  <p className="mb-1 text-light-50" style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
                    {feed.content}
                  </p>
                  {feed.created_by && (
                    <small className="text-muted">From: <span className="text-info">{feed.created_by}</span></small>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showInbox && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ zIndex: 1055, background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowInbox(false)}
        />
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-grow-1 overflow-auto p-3"
      >

        {!conversationId && messages.length === 0 ? (
           <div className="h-100 d-flex flex-column p-md-5 p-3 overflow-auto" style={{ zIndex: 10 }}>
                <div className="mb-5 text-center text-md-start">
                  <h1 className="text-light fw-bold display-5 mb-2">
                    Welcome to Relex AI
                  </h1>
                  <p className="text-light-50 fs-5">Hello, <span className="text-info">{user.username}</span>! What would you like to do today?</p>
                </div>
                
                <div className="row g-4 mb-5">
                  <div className="col-md-4">
                    <div className="glass-card text-center cursor-pointer h-100 d-flex flex-column justify-content-center" onClick={() => document.querySelector('.chat-input')?.focus()}>
                      <div className="display-4 mb-3">💬</div>
                      <h4 className="text-info mb-3">New Chat</h4>
                      <p className="text-light-50 small mb-0">Type a message below to start.</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="glass-card text-center cursor-pointer h-100 d-flex flex-column justify-content-center" onClick={() => navigate('/context')}>
                      <div className="display-4 mb-3">🧠</div>
                      <h4 className="text-warning mb-3">AI Memory</h4>
                      <p className="text-light-50 small mb-0">View your personalized knowledge base.</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="glass-card text-center cursor-pointer h-100 d-flex flex-column justify-content-center" onClick={() => { if(onOpenProfile) onOpenProfile(); }}>
                      <div className="display-4 mb-3">⚙️</div>
                      <h4 className="text-success mb-3">Settings</h4>
                      <p className="text-light-50 small mb-0">Manage your profile and preferences.</p>
                    </div>
                  </div>
                </div>
           </div>
        ) : (
          <>
            {loadingOld && (
              <div className="text-center text-muted mb-2">
                Loading older messages...
              </div>
            )}
    
            {messages.map((m, i) => (
              <div key={i} className={`position-relative ${m.role === "assistant" ? "ai-message" : ""}`}>
                <MessageBubble role={m.role} text={m.content} isStreaming={m.isStreaming} />
                {m.role === "assistant" && !m.isStreaming && m.content && (
                  <div className="d-flex justify-content-start mt-1 ms-3 mb-2">
                    <button
                      className={`voice-speaker-btn ${activeSpeakId === m.id ? "active" : ""}`}
                      onClick={() => toggleSpeakText(m.id || i, m.content)}
                      title="Speak response aloud"
                    >
                      🔊 Speak Answer
                    </button>
                  </div>
                )}
              </div>
            ))}
    
            {isStreamingRef.current && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content && (
              <div className="typing-indicator mt-2 mb-3 ms-2">
                <span></span><span></span><span></span>
              </div>
            )}
          </>
        )}

        <div ref={bottomRef} />

      </div>

      {isUploading && (
        <div className="px-3 py-1 bg-light border-top text-muted d-flex align-items-center" style={{ fontSize: "0.85rem" }}>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Uploading & extracting document...
        </div>
      )}

      <div className="p-2 border-top d-flex gap-2 align-items-center glass-header">

        <input
          type="file"
          id="uploadFile"
          accept=".pdf,.txt,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleUpload}
        />

        <label htmlFor="uploadFile" className="btn btn-outline-secondary mb-0">
          📎
        </label>

        <button
          className={`voice-mic-btn ${isRecording ? "recording" : ""}`}
          onClick={toggleRecording}
          title={isRecording ? "Listening..." : "Dictate with voice"}
        >
          🎙️
        </button>

        <button
          className="btn btn-outline-info"
          onClick={() => setShowPromptsModal(true)}
          title="Prompt Library"
        >
          📑
        </button>

        <textarea
          className="form-control chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message..."
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ resize: "none" }}
        />

        {messages.length > 0 && (
          <button
            className="btn btn-outline-info d-flex align-items-center gap-1"
            onClick={exportPdfReport}
            title="Export chat to PDF"
          >
            📄 PDF Report
          </button>
        )}

        {isGenerating ? (
          <button
            className="btn btn-danger d-flex align-items-center gap-2"
            onClick={handleStop}
          >
            <span>Stop Generating</span>
            <span style={{ fontSize: "0.80rem" }}>⏹</span>
          </button>
        ) : (
          <button
            className="btn btn-primary px-4"
            onClick={send}
          >
            Send
          </button>
        )}
      </div>

      {/* Prompts Modal - Fully inline styled */}
      {showPromptsModal && (
        <>
          <div onClick={() => setShowPromptsModal(false)} style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.65)",zIndex:1049,backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1050,width:"min(560px,95vw)",background:"linear-gradient(145deg,#1a1928,#141420)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"20px",boxShadow:"0 30px 80px rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",maxHeight:"85vh",overflow:"hidden" }}>
            <div style={{ padding:"18px 22px 14px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div>
                <h5 style={{ margin:0,fontSize:"1.05rem",fontWeight:700,color:"#fff" }}>📑 Prompt Library</h5>
                <p style={{ margin:0,fontSize:"0.76rem",color:"#64748b",marginTop:"2px" }}>Save & reuse your favourite prompts</p>
              </div>
              <button onClick={() => setShowPromptsModal(false)} style={{ background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:"8px",width:"32px",height:"32px",cursor:"pointer",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
            </div>
            <div style={{ flex:1,overflowY:"auto",padding:"14px 22px" }}>
              {prompts.length === 0 ? (
                <div style={{ textAlign:"center",padding:"36px 0" }}>
                  <div style={{ fontSize:"2.5rem",marginBottom:"10px" }}>📭</div>
                  <p style={{ margin:0,fontWeight:600,color:"#64748b",fontSize:"0.9rem" }}>No saved prompts yet.</p>
                  <small style={{ color:"#475569" }}>Write a prompt below and click Save.</small>
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
                  {prompts.map(p => (
                    <div key={p.id} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px" }}>
                      <div style={{ flex:1,cursor:"pointer",minWidth:0 }} onClick={() => { setInput(p.content); setShowPromptsModal(false); }} title="Click to insert into chat">
                        <div style={{ fontWeight:700,color:"#67e8f9",fontSize:"0.87rem",marginBottom:"3px" }}>{p.title}</div>
                        <div style={{ color:"#94a3b8",fontSize:"0.77rem",lineHeight:1.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.content}</div>
                        <div style={{ fontSize:"0.67rem",color:"#334155",marginTop:"3px" }}>Click to insert →</div>
                      </div>
                      <button onClick={() => handleDeletePrompt(p.id)} style={{ background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171",borderRadius:"8px",padding:"4px 10px",cursor:"pointer",fontSize:"0.8rem",flexShrink:0 }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding:"14px 22px 20px",borderTop:"1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ margin:"0 0 8px",fontSize:"0.8rem",fontWeight:600,color:"#94a3b8" }}>➕ Save New Prompt</p>
              <textarea
                placeholder="Prompt content..."
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={2}
                style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",color:"#fff",fontSize:"0.84rem",padding:"9px 12px",resize:"vertical",marginBottom:"9px",outline:"none",boxSizing:"border-box",fontFamily:"inherit" }}
              />
              <div style={{ display:"flex",gap:"8px" }}>
                <input
                  type="text"
                  placeholder="Prompt title..."
                  value={newPromptTitle}
                  onChange={e => setNewPromptTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSavePrompt()}
                  style={{ flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",color:"#fff",fontSize:"0.84rem",padding:"9px 12px",outline:"none" }}
                />
                <button
                  onClick={handleSavePrompt}
                  disabled={!input.trim() || !newPromptTitle.trim()}
                  style={{ background:(!input.trim()||!newPromptTitle.trim())?"rgba(99,102,241,0.2)":"rgba(99,102,241,0.9)",border:"1px solid rgba(99,102,241,0.5)",color:"#fff",borderRadius:"10px",padding:"9px 20px",fontWeight:700,fontSize:"0.84rem",cursor:(!input.trim()||!newPromptTitle.trim())?"not-allowed":"pointer" }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}


    </div>
  );
}