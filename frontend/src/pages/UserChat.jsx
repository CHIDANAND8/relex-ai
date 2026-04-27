import { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import PremiumBackground from "../components/PremiumBackground";
import CinematicOverlay from "../components/CinematicOverlay";

import { useNavigate } from "react-router-dom";

export default function UserChat() {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // AI Context State (kept for context page)
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

    // clear stored AI context
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
    }

  };

  if (!user) return null;

  return (
    <div className="user-page-wrapper">

      {/* Premium Background */}
      <PremiumBackground />
      <CinematicOverlay />

      <div className="ai-signature">
        RELEX<span>AI</span>
      </div>

      <div className="d-flex position-relative" style={{ zIndex: 5 }}>

        {/* ================= SIDEBAR ================= */}
        <div
          className={`bg-dark glass-sidebar ${
            sidebarOpen ? "" : "d-none d-md-block"
          }`}
          style={{ width: "280px" }}
        >
          <Sidebar
            user={user}
            onSelect={handleSelectConversation}
            activeConversationId={conversationId}
            onLogout={logout}
          />
        </div>

        {/* ================= MAIN AREA ================= */}
        <div className="flex-grow-1 d-flex flex-column vh-100 glass-main">

          {/* ================= HEADER ================= */}
          <div className="border-bottom p-2 d-flex justify-content-between align-items-center glass-header">

            <button
              className="btn btn-sm btn-outline-light d-md-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>

            <div className="position-relative">

              <button
                className="btn btn-light"
                onClick={() => setShowProfile(!showProfile)}
              >
                {user.username}
              </button>

              {showProfile && (
                <div
                  className="position-absolute bg-dark border shadow-sm p-3 rounded text-light"
                  style={{
                    right: 0,
                    top: "40px",
                    minWidth: "200px",
                    zIndex: 20
                  }}
                >

                  <div className="small text-info mb-2">
                    Role: {user.role}
                  </div>

                  <button
                    className="btn btn-sm btn-danger w-100"
                    onClick={logout}
                  >
                    Logout
                  </button>

                </div>
              )}

            </div>

          </div>

          {/* ================= CHAT AREA ================= */}
          <div className="flex-grow-1">

            {conversationId ? (

              <div className="h-100">

                <ChatWindow
                  user={user}
                  conversationId={conversationId}
                  setContextData={setContextData}
                />

              </div>

            ) : (

              <div className="h-100 d-flex align-items-center justify-content-center text-info">
                Start a new conversation
              </div>

            )}

          </div>

        </div>

        <div className="flagship-ambient"></div>

      </div>
    </div>
  );
}