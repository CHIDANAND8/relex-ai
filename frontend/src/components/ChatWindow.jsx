import { useState, useEffect, useRef, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import { sendMessage, getMessages } from "../services/api";

/**
 * ChatWindow
 * Props:
 *  - user
 *  - conversationId
 *  - setContextData (NEW)
 */
export default function ChatWindow({ user, conversationId, setContextData }) {

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [hasMore, setHasMore] = useState(true);
  const [loadingOld, setLoadingOld] = useState(false);

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
    [conversationId, offset]
  );

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);

    if (!conversationId) return;

    loadMessages(true);
  }, [conversationId, loadMessages]);

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

    if (!conversationId) {
      alert("Please create or select a conversation first.");
      return;
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
        conversation_id: conversationId,
        message: input
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

    if (nearBottom) {
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

    const formData = new FormData();
    formData.append("file", file);

    try {

      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Upload failed:", txt);
        alert("Upload failed");
        return;
      }

      const data = await res.json().catch(() => null);
      
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

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-grow-1 overflow-auto p-3"
      >

        {loadingOld && (
          <div className="text-center text-muted mb-2">
            Loading older messages...
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "assistant" ? "ai-message" : ""}>
            <MessageBubble role={m.role} text={m.content} isStreaming={m.isStreaming} />
          </div>
        ))}

        {/* ChatGPT Style waiting dots (only shows before the first word streams) */}
        {isStreamingRef.current && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content && (
          <div className="typing-indicator mt-2 mb-3 ms-2">
            <span></span><span></span><span></span>
          </div>
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

        <label htmlFor="uploadFile" className="btn btn-outline-secondary">
          📎
        </label>

        <textarea
          className="form-control chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={!conversationId ? "Select or create a conversation..." : "Send a message..."}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!conversationId}
          style={{ resize: "none" }}
        />

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
            disabled={!conversationId}
          >
            Send
          </button>
        )}

      </div>
    </div>
  );
}