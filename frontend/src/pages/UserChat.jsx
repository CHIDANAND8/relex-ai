import { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";


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

      {/* Clean Background */}

      <div className="d-flex position-relative" style={{ zIndex: 5 }}>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div 
             className="position-absolute w-100 h-100 d-md-none" 
             style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2 }} 
             onClick={() => setSidebarOpen(false)} 
          />
        )}

        {/* ================= SIDEBAR ================= */}
        <div
          className={`glass-sidebar position-absolute position-md-static h-100 z-3 ${
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
              {(() => {
                const getProvider = () => {
                  if (user.provider) return user.provider;
                  const email = (user.username || "").toLowerCase();
                  if (email.includes("google") || email.endsWith("@gmail.com")) return "google";
                  if (email.includes("facebook") || email.endsWith("@facebook.com") || email.includes("fb_")) return "facebook";
                  return "standard";
                };
                const provider = getProvider();
                return (
                  <div
                    className="header-profile-pill"
                    onClick={() => setShowProfile(!showProfile)}
                  >
                    <div className="header-profile-avatar">
                      {provider === "google" && (
                        <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '12px', height: '12px' }}>
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                        </svg>
                      )}
                      {provider === "facebook" && (
                        <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '12px', height: '12px' }}>
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
                        </svg>
                      )}
                      {provider === "standard" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-light-50">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                    <span className="text-truncate" style={{ maxWidth: '140px' }} title={user.username}>
                      {user.username}
                    </span>
                    <span className="header-status-indicator"></span>
                  </div>
                );
              })()}

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

            <div className="h-100">
              <ChatWindow
                user={user}
                conversationId={conversationId}
                setContextData={setContextData}
                onConversationCreated={handleSelectConversation}
                onOpenProfile={() => setShowProfile(true)}
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}