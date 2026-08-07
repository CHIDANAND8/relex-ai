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

  useEffect(() => {
    loadPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [copiedId, setCopiedId] = useState(null);       // tracks which msg was just copied
  const [thumbsVal, setThumbsVal] = useState({});       // { msgId: 'up'|'down' }
  const [showMoreMenu, setShowMoreMenu] = useState(null); // message id for '...' popup
  const [showVoiceSubMenu, setShowVoiceSubMenu] = useState(false); // inside more-menu
  const [showShareModal, setShowShareModal] = useState(false);     // share modal
  const [shareModalMsg, setShareModalMsg] = useState(null);        // { content, shareUrl }
  const [shareModalCopied, setShareModalCopied] = useState(false); // copy-link feedback
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Voice mode: 'default' | 'female_young' | 'female_mature' | 'male_deep'
  const [voiceMode, setVoiceMode] = useState(() =>
    localStorage.getItem("voice_mode") || "default"
  );
  // Keep a ref in sync so toggleSpeakText (a closure) always reads the latest mode
  const voiceModeRef = useRef(localStorage.getItem("voice_mode") || "default");

  // ---------------------------------------------------------------
  // Cache voices after the async voiceschanged event fires.
  // getVoices() returns [] on first call in Chrome/Edge, causing
  // voice selection to silently fall back to the system default.
  // ---------------------------------------------------------------
  const cachedVoicesRef = useRef([]);

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoicesRef.current = v;
      }
    };
    // Try immediately (works in Firefox)
    loadVoices();
    // Also listen for the async event (required for Chrome / Edge)
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Helper — pick the best available voice for a given mode
  const getVoice = (mode) => {
    // Prefer live list; fall back to cached list populated by voiceschanged
    const live = window.speechSynthesis.getVoices();
    const voices = live.length > 0 ? live : cachedVoicesRef.current;
    if (!voices.length) return null;

    if (mode === "female_young") {
      // Bright, clear female voices
      const preferred = ["Microsoft Zira", "Google UK English Female", "Samantha", "Karen", "Tessa"];
      for (const name of preferred) {
        const v = voices.find(v => v.name.includes(name));
        if (v) return v;
      }
      // Generic female fallback
      return voices.find(v =>
        v.name.toLowerCase().includes("female") ||
        ["zira", "linda", "aria"].some(n => v.name.toLowerCase().includes(n))
      ) || null;
    }

    if (mode === "female_mature") {
      // Calm, mature female voices.
      // NOTE: "Google US English" was intentionally removed — it is a MALE voice.
      const preferred = ["Microsoft Hazel", "Microsoft Susan", "Moira", "Fiona", "Victoria", "Microsoft Zira"];
      for (const name of preferred) {
        const v = voices.find(v => v.name.includes(name));
        if (v) return v;
      }
      // Generic female fallback — avoid voices with 'male' in their name
      return voices.find(v =>
        v.name.toLowerCase().includes("female") ||
        ["hazel", "susan", "linda", "zira"].some(n => v.name.toLowerCase().includes(n))
      ) || null;
    }

    if (mode === "male_deep") {
      // Deep, authoritative male voices
      const preferred = ["Microsoft David", "Microsoft Mark", "Google UK English Male", "Daniel", "Arthur", "Alex", "Fred"];
      for (const name of preferred) {
        const v = voices.find(v => v.name.includes(name));
        if (v) return v;
      }
      // Generic male fallback — avoid voices with 'female' in their name
      return voices.find(v =>
        !v.name.toLowerCase().includes("female") && (
          v.name.toLowerCase().includes("male") ||
          ["david", "mark", "george", "james", "richard"].some(n => v.name.toLowerCase().includes(n))
        )
      ) || null;
    }

    return null; // default = browser default
  };

  const toggleSpeakText = (id, text) => {
    if (activeSpeakId === id) {
      window.speechSynthesis.cancel();
      setActiveSpeakId(null);
    } else {
      window.speechSynthesis.cancel();
      // Strip markdown-style annotations
      const cleanText = text
        .replace(/\[.*?\]/g, "")
        .replace(/#{1,6}\s?/g, "")
        .replace(/[*_`~]/g, "")
        .trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Use voiceModeRef so we always get the current mode even inside a closure
      const mode = voiceModeRef.current;

      if (mode === "female_young") {
        utterance.pitch  = 1.35;   // Bright, cheerful
        utterance.rate   = 1.05;
        utterance.volume = 1.0;
        const voice = getVoice("female_young");
        if (voice) utterance.voice = voice;
      } else if (mode === "female_mature") {
        utterance.pitch  = 1.0;    // Natural pitch — let the voice itself sound female
        utterance.rate   = 0.92;   // Slightly slower, calm delivery
        utterance.volume = 1.0;
        const voice = getVoice("female_mature");
        if (voice) utterance.voice = voice;
      } else if (mode === "male_deep") {
        utterance.pitch  = 0.7;    // Lower pitch for depth
        utterance.rate   = 0.93;   // Steady, deliberate pace
        utterance.volume = 1.0;
        const voice = getVoice("male_deep");
        if (voice) utterance.voice = voice;
      } else {
        // Default: browser system voice, unmodified
        utterance.pitch  = 1.0;
        utterance.rate   = 1.0;
        utterance.volume = 1.0;
      }

      utterance.lang = "en-US";
      utterance.onend   = () => setActiveSpeakId(null);
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
      <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom glass-header position-relative" style={{ zIndex: 100 }}>
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
            <span className="badge px-1 px-md-2 py-1 rounded-pill" style={{ fontSize: "0.65rem", background: "rgba(0, 210, 255, 0.15)", color: "#00d2ff", border: "1px solid rgba(0, 210, 255, 0.3)" }}>
              {currentModelObj.badge}
            </span>
            <span className="fw-bold text-light" style={{ fontSize: "0.75rem" }}>
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
            <span className="fw-bold text-light" style={{ fontSize: "0.75rem" }}>
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
           <div className="h-100 d-flex flex-column p-2 p-md-5 overflow-auto" style={{ zIndex: 10 }}>
                <div className="mb-4 text-center text-md-start">
                  <h1 className="text-light fw-bold fs-2 mb-2">
                    Welcome to Relex AI
                  </h1>
                  <p className="text-light-50 fs-6">Hello, <span className="text-info">{user.username}</span>! What would you like to do today?</p>
                </div>
                
                <div className="row g-4 mb-5">
                  <div className="col-md-4">
                    <div className="glass-card text-center cursor-pointer h-100 d-flex flex-column justify-content-center py-4" onClick={() => document.querySelector('.chat-input')?.focus()}>
                      <div className="fs-1 mb-2">💬</div>
                      <h5 className="text-info mb-2 fw-bold">New Chat</h5>
                      <p className="text-light-50 small mb-0">Type a message below to start.</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="glass-card text-center cursor-pointer h-100 d-flex flex-column justify-content-center py-4" onClick={() => navigate('/context')}>
                      <div className="fs-1 mb-2">🧠</div>
                      <h5 className="text-warning mb-2 fw-bold">AI Memory</h5>
                      <p className="text-light-50 small mb-0">View your personalized knowledge base.</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="glass-card text-center cursor-pointer h-100 d-flex flex-column justify-content-center py-4" onClick={() => { if(onOpenProfile) onOpenProfile(); }}>
                      <div className="fs-1 mb-2">⚙️</div>
                      <h5 className="text-success mb-2 fw-bold">Settings</h5>
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
    
            {messages.map((m, i) => {
              const msgKey = m.id || i;
              return (
              <div key={i} className={`position-relative msg-row ${m.role === "assistant" ? "ai-message" : ""}`}>
                <MessageBubble role={m.role} text={m.content} isStreaming={m.isStreaming} />

                {/* =============================================
                    ChatGPT-style action bar — shows on hover
                    ============================================= */}
                {m.role === "assistant" && !m.isStreaming && m.content && (
                  <div className="msg-action-bar d-flex align-items-center gap-1 ms-2 mb-3">

                    {/* Copy */}
                    <button
                      className="msg-icon-btn"
                      title="Copy"
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        setCopiedId(msgKey);
                        setTimeout(() => setCopiedId(null), 1800);
                      }}
                    >
                      {copiedId === msgKey ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      )}
                    </button>

                    {/* Thumbs Up */}
                    <button
                      className={`msg-icon-btn ${thumbsVal[msgKey] === 'up' ? 'msg-icon-btn--active-good' : ''}`}
                      title="Good response"
                      onClick={() => setThumbsVal(p => ({ ...p, [msgKey]: p[msgKey] === 'up' ? null : 'up' }))}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={thumbsVal[msgKey] === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    </button>

                    {/* Thumbs Down */}
                    <button
                      className={`msg-icon-btn ${thumbsVal[msgKey] === 'down' ? 'msg-icon-btn--active-bad' : ''}`}
                      title="Bad response"
                      onClick={() => setThumbsVal(p => ({ ...p, [msgKey]: p[msgKey] === 'down' ? null : 'down' }))}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={thumbsVal[msgKey] === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                    </button>

                    {/* Share — opens the ChatGPT-style share modal */}
                    <button
                      className="msg-icon-btn"
                      title="Share"
                      onClick={async () => {
                        let shareUrl = window.location.href;
                        try {
                          const res = await generateShareLink(conversationId);
                          if (res?.share_url) shareUrl = res.share_url;
                        } catch(e) { /* use current URL as fallback */ }
                        setShareModalMsg({ content: m.content, shareUrl });
                        setShareModalCopied(false);
                        setShowShareModal(true);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    </button>

                    {/* Regenerate */}
                    <button
                      className="msg-icon-btn"
                      title="Regenerate response"
                      onClick={() => {
                        // find last user message and resend it
                        const lastUser = [...messages].reverse().find(x => x.role === 'user');
                        if (lastUser) { setInput(lastUser.content); }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>

                    {/* ··· More menu */}
                    <div className="position-relative">
                      <button
                        className="msg-icon-btn"
                        title="More options"
                        onClick={() => {
                          setShowMoreMenu(prev => prev === msgKey ? null : msgKey);
                          setShowVoiceSubMenu(false);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                      </button>

                      {showMoreMenu === msgKey && (
                        <>
                          {/* Backdrop */}
                          <div
                            onClick={() => { setShowMoreMenu(null); setShowVoiceSubMenu(false); }}
                            style={{ position:"fixed", inset:0, zIndex:1199 }}
                          />

                          {/* Popup card — ChatGPT style */}
                          <div style={{
                            position:"absolute", bottom:"calc(100% + 8px)", left:0,
                            background:"rgba(18,18,28,0.98)",
                            border:"1px solid rgba(255,255,255,0.1)",
                            borderRadius:"14px",
                            padding:"6px",
                            zIndex:1200,
                            minWidth:"210px",
                            boxShadow:"0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                            backdropFilter:"blur(16px)"
                          }}>

                            {/* Timestamp label */}
                            {/*<div style={{ fontSize:"0.68rem", color:"#475569", padding:"4px 12px 8px", letterSpacing:"0.3px" }}>
                              {new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                            </div>*/}

                            {/* View sources */}
                            <button
                              className="more-menu-item"
                              onClick={() => {
                                navigate('/context');
                                setShowMoreMenu(null);
                              }}
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                              <span>View sources</span>
                            </button>

                            {/* Branch in new chat */}
                            <button
                              className="more-menu-item"
                              onClick={async () => {
                                try {
                                  const snippet = m.content.slice(0, 60);
                                  const newConv = await createConversation({ user_id: user.id, title: `Branch: ${snippet}` });
                                  if (newConv?.id) {
                                    if (onConversationCreated) onConversationCreated(newConv.id);
                                  }
                                } catch(e) { console.log(e); }
                                setShowMoreMenu(null);
                              }}
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                              <span>Branch in new chat</span>
                            </button>

                            <div style={{ height:"1px", background:"rgba(255,255,255,0.07)", margin:"4px 8px" }} />

                            {/* Read aloud — expands voice sub-menu */}
                            <button
                              className="more-menu-item"
                              onClick={() => setShowVoiceSubMenu(p => !p)}
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                              <span>
                                {activeSpeakId === msgKey ? "⏹ Stop reading" : "Read aloud"}
                                {voiceMode !== "default" && (
                                  <span style={{ fontSize:"0.7rem", color:"#64748b", marginLeft:"6px" }}>
                                    ({voiceMode === "male_deep" ? "👨 Male" : voiceMode === "female_young" ? "👩 Young" : "👩 Calm"})
                                  </span>
                                )}
                              </span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:"auto", transform: showVoiceSubMenu ? "rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                            </button>

                            {/* Read aloud action row */}
                            <div style={{ display:"flex", gap:"6px", padding:"4px 8px 2px", justifyContent:"space-between" }}>
                              <button
                                className="read-aloud-play-btn"
                                onClick={() => {
                                  setShowMoreMenu(null);
                                  toggleSpeakText(msgKey, m.content);
                                }}
                              >
                                {activeSpeakId === msgKey
                                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop</>
                                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play</>}
                              </button>
                            </div>

                            {/* Voice sub-menu */}
                            {showVoiceSubMenu && (
                              <div style={{ padding:"4px 6px 4px" }}>
                                {[
                                  { id: "default",       icon: "🔊", label: "Default",        sub: "System voice" },
                                  { id: "female_young",  icon: "👩", label: "Female · Young", sub: "Clear & energetic" },
                                  { id: "female_mature", icon: "👩", label: "Female · Calm",  sub: "Mature & steady" },
                                  { id: "male_deep",     icon: "👨", label: "Male · Deep",    sub: "Deep & authoritative" },
                                ].map(opt => (
                                  <div
                                    key={opt.id}
                                    onClick={() => {
                                      setVoiceMode(opt.id);
                                      voiceModeRef.current = opt.id;
                                      localStorage.setItem("voice_mode", opt.id);
                                      setShowVoiceSubMenu(false);
                                    }}
                                    style={{
                                      display:"flex", alignItems:"center", gap:"10px",
                                      padding:"7px 10px", borderRadius:"8px", cursor:"pointer",
                                      background: voiceMode === opt.id ? "rgba(139,92,246,0.15)" : "transparent",
                                      border: voiceMode === opt.id ? "1px solid rgba(139,92,246,0.35)" : "1px solid transparent",
                                      marginBottom:"2px"
                                    }}
                                  >
                                    <span style={{ fontSize:"1rem" }}>{opt.icon}</span>
                                    <div>
                                      <div style={{ fontSize:"0.8rem", fontWeight:600, color: voiceMode === opt.id ? "#a78bfa" : "#e2e8f0" }}>{opt.label}</div>
                                      <div style={{ fontSize:"0.68rem", color:"#475569" }}>{opt.sub}</div>
                                    </div>
                                    {voiceMode === opt.id && (
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:"auto" }}><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        </>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
            })}
    
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


      {/* =========================================================
          CHATGPT-STYLE SHARE MODAL
      ========================================================= */}
      {showShareModal && shareModalMsg && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowShareModal(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              zIndex: 8000
            }}
          />

          {/* Modal card */}
          <div style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
            width: "min(520px, 92vw)",
            zIndex: 8001,
            boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
            overflow: "hidden",
            fontFamily: "'Inter', sans-serif"
          }}>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "22px 24px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.08)"
            }}>
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "#ffffff" }}>
                Share
              </h2>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  background: "none", border: "none", color: "#94a3b8",
                  cursor: "pointer", padding: "6px", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.15s ease, background 0.15s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "none"; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px 26px" }}>

              {/* Message preview card */}
              <div style={{
                background: "#2a2a2a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                overflow: "hidden",
                marginBottom: "28px"
              }}>
                {/* Card toolbar */}
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)"
                }}>
                  {/* Edit button */}
                  <button
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      background: "none", border: "none",
                      color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600,
                      cursor: "pointer", padding: "4px 8px",
                      borderRadius: "7px", transition: "background 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>

                  {/* Right icons: Copy / Download / Expand */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    {[
                      {
                        title: "Copy",
                        onClick: () => { navigator.clipboard.writeText(shareModalMsg.content); },
                        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      },
                      {
                        title: "Download",
                        onClick: () => {
                          const blob = new Blob([shareModalMsg.content], { type: "text/plain" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = "relex-ai-response.txt";
                          a.click();
                        },
                        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      },
                      {
                        title: "Expand",
                        onClick: () => {},
                        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                      }
                    ].map((btn, bi) => (
                      <button
                        key={bi}
                        title={btn.title}
                        onClick={btn.onClick}
                        style={{
                          background: "none", border: "none",
                          color: "#94a3b8", cursor: "pointer",
                          padding: "5px", borderRadius: "7px",
                          display: "flex", alignItems: "center",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "none"; }}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message preview text */}
                <div style={{
                  padding: "14px 16px",
                  maxHeight: "160px",
                  overflowY: "auto",
                  lineHeight: 1.65,
                  color: "#d4d4d4",
                  fontSize: "0.88rem"
                }}>
                  {shareModalMsg.content.slice(0, 420)}{shareModalMsg.content.length > 420 ? "…" : ""}
                </div>

                {/* RELEX AI watermark */}
                <div style={{
                  padding: "10px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", justifyContent: "flex-end"
                }}>
                  <span style={{
                    fontSize: "0.8rem", fontWeight: 800,
                    color: "#ffffff", letterSpacing: "-0.02em", opacity: 0.85
                  }}>
                    RELEX AI
                  </span>
                </div>
              </div>

              {/* Social share circles */}
              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: "28px"
              }}>
                {[
                  {
                    label: "Copy link",
                    bg: "#ffffff",
                    color: "#000000",
                    onClick: () => {
                      navigator.clipboard.writeText(shareModalMsg.shareUrl);
                      setShareModalCopied(true);
                      setTimeout(() => setShareModalCopied(false), 2000);
                    },
                    icon: shareModalCopied
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  },
                  {
                    label: "X",
                    bg: "#000000",
                    color: "#ffffff",
                    onClick: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareModalMsg.content.slice(0,240))}&url=${encodeURIComponent(shareModalMsg.shareUrl)}`, "_blank"),
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  },
                  {
                    label: "LinkedIn",
                    bg: "#0A66C2",
                    color: "#ffffff",
                    onClick: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareModalMsg.shareUrl)}`, "_blank"),
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  },
                  {
                    label: "Reddit",
                    bg: "#FF4500",
                    color: "#ffffff",
                    onClick: () => window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(shareModalMsg.shareUrl)}&title=${encodeURIComponent(shareModalMsg.content.slice(0,100))}`, "_blank"),
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                  }
                ].map((s, si) => (
                  <div key={si} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={s.onClick}
                      title={s.label}
                      style={{
                        width: "56px", height: "56px",
                        borderRadius: "50%",
                        background: s.bg,
                        color: s.color,
                        border: "none",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.18s ease, box-shadow 0.18s ease",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.35)"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)"; }}
                    >
                      {s.icon}
                    </button>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>
                      {s.label === "Copy link" && shareModalCopied ? "Copied!" : s.label}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </>
      )}


    </div>
  );
}