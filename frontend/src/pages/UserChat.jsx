import { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { useNavigate } from "react-router-dom";

export default function UserChat() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar_open");
    if (saved !== null) return saved === "true";
    return window.innerWidth >= 768;
  });

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_open", String(next));
      return next;
    });
  }, []);

  // AI Context State
  const [, setContextData] = useState(null);

  // =========================
  // LOAD USER + LAST CHAT
  // =========================
  useEffect(() => {
    const stored = localStorage.getItem("user");

    if (!stored) {
      navigate("/");
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setUser(parsed);
    } catch (err) {
      console.error("User parse error", err);
      navigate("/");
      return;
    }

    const lastConv = localStorage.getItem("lastConversation");
    if (lastConv) {
      setConversationId(Number(lastConv));
    }
  }, [navigate]);

  // =========================
  // RESET CONTEXT WHEN CHAT CHANGES
  // =========================
  useEffect(() => {
    setContextData(null);
    localStorage.removeItem("ai_context");
  }, [conversationId]);

  // =========================
  // SAVE LAST CONVERSATION
  // =========================
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem("lastConversation", conversationId);
    }
  }, [conversationId]);

  // =========================
  // LOGOUT
  // =========================
  const logout = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("lastConversation");
    localStorage.removeItem("ai_context");
    navigate("/");
  }, [navigate]);

  // =========================
  // SELECT CHAT
  // =========================
  const handleSelectConversation = (id) => {
    setConversationId(id);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
      localStorage.setItem("sidebar_open", "false");
    }
  };

  if (!user) return null;

  return (
    <div className="user-page-wrapper">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="d-md-none position-fixed top-0 start-0 w-100 h-100"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", zIndex: 1040 }}
          onClick={toggleSidebar}
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside className={`glass-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <Sidebar
          user={user}
          onSelect={handleSelectConversation}
          activeConversationId={conversationId}
          onLogout={logout}
          onCloseSidebar={toggleSidebar}
        />
      </aside>

      {/* ================= MAIN CHAT WINDOW ================= */}
      <main className="glass-main">
        <ChatWindow
          user={user}
          conversationId={conversationId}
          setContextData={setContextData}
          onConversationCreated={handleSelectConversation}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={toggleSidebar}
          onLogout={logout}
        />
      </main>
    </div>
  );
}