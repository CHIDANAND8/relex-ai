import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getConversations,
  createConversation,
  deleteConversation,
  searchConversations
} from "../services/api";
import { apiFetch } from "../services/apiClient";

export default function Sidebar({
  user,
  onSelect = () => {},
  activeConversationId,
  onOpenDashboard = () => {},
  onLogout = () => {},
  onCloseSidebar = () => {},
  isDashboardOpen = false
}) {


  const navigate = useNavigate();

  const [convs, setConvs] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);

  const [feeds, setFeeds] = useState([]);
  const [unreadFeeds, setUnreadFeeds] = useState([]);
  const [showFeedDropdown, setShowFeedDropdown] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light');
  const [smoothAnim, setSmoothAnim] = useState(localStorage.getItem('smoothAnim') !== 'false');
  const [highContrast, setHighContrast] = useState(localStorage.getItem('highContrast') === 'true');
  const [autoScroll, setAutoScroll] = useState(localStorage.getItem('autoScroll') !== 'false');

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
    window.dispatchEvent(new Event('settingsChanged'));
  }, [isLightMode]);

  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast');
      localStorage.setItem('highContrast', 'true');
    } else {
      document.body.classList.remove('high-contrast');
      localStorage.setItem('highContrast', 'false');
    }
    window.dispatchEvent(new Event('settingsChanged'));
  }, [highContrast]);

  useEffect(() => {
    if (!smoothAnim) {
      document.body.classList.add('no-animations');
      localStorage.setItem('smoothAnim', 'false');
    } else {
      document.body.classList.remove('no-animations');
      localStorage.setItem('smoothAnim', 'true');
    }
    window.dispatchEvent(new Event('settingsChanged'));
  }, [smoothAnim]);

  useEffect(() => {
    localStorage.setItem('autoScroll', autoScroll ? 'true' : 'false');
  }, [autoScroll]);

  // Format Time
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Load Conversations
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      let data;
      if (searchQuery.trim().length > 0) {
        data = await searchConversations(user.id, searchQuery);
      } else {
        data = await getConversations(user.id);
      }
      const safeData = Array.isArray(data) ? data : [];
      setConvs(safeData);

      if (activeConversationId) {
        const isOwned = safeData.some((c) => c.id === activeConversationId);
        if (!isOwned && searchQuery.trim().length === 0) {
          onSelect(null);
          localStorage.removeItem("lastConversation");
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [user?.id, activeConversationId, onSelect, searchQuery]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Load Feeds
  const loadFeeds = useCallback(async () => {
    if (!user || user.role === "admin") return;
    try {
      const data = await apiFetch(`/admin/user-feeds/${user.username}`);
      const safeFeeds = Array.isArray(data) ? data : [];
      setFeeds(safeFeeds);

      const unread = safeFeeds.filter(f => {
        try {
          const viewed = JSON.parse(f.viewed_by || "[]");
          return !viewed.includes(user.username);
        } catch (e) {
          return true;
        }
      });

      setUnreadFeeds(unread);
    } catch (err) {
      console.error("Failed to load feeds:", err);
    }
  }, [user]);

  useEffect(() => {
    loadFeeds();
    const interval = setInterval(loadFeeds, 10000);
    return () => clearInterval(interval);
  }, [loadFeeds]);

  // Mark feeds viewed
  const markFeedsAsViewed = async () => {
    if (!user || user.role === "admin") return;
    try {
      for (const feed of unreadFeeds) {
        await apiFetch(`/admin/mark-feed-viewed/${feed.id}/${user.username}`, {
          method: "POST"
        });
      }
      setUnreadFeeds([]);
    } catch (err) {
      console.error("Mark viewed error:", err);
    }
  };

  // Create New Chat
  const newChat = async () => {
    if (!user?.id) return;
    try {
      const data = await createConversation({
        user_id: user.id,
        title: "New Chat"
      });

      await loadConversations();

      if (data?.id) {
        onSelect(data.id);
        navigate("/chat");
      }
    } catch (err) {
      console.error("Create chat error:", err);
    }
  };

  // Delete Chat
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      if (id === activeConversationId) {
        onSelect(null);
      }
      loadConversations();
    } catch (err) {
      console.error("Delete conversation error:", err);
    }
  };

  // Toggle Pin
  const togglePin = async (id, e) => {
    e.stopPropagation();
    try {
      await apiFetch(`/conversation/pin/${id}`, {
        method: "POST"
      });
      loadConversations();
    } catch (err) {
      console.error("Toggle pin error:", err);
    }
  };

  // Filter & Group conversations
  const { pinnedConvs, recentConvs } = useMemo(() => {
    const pinned = [];
    const recent = [];
    convs.forEach(c => {
      if (c.is_pinned) pinned.push(c);
      else recent.push(c);
    });
    return { pinnedConvs: pinned, recentConvs: recent };
  }, [convs]);

  // Render Individual Conversation Item
  const renderItem = (c) => {
    const active = c.id === activeConversationId;

    return (
      <div
        key={c.id}
        onMouseEnter={() => setHoveredId(c.id)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => {
          onSelect(c.id);
          navigate("/chat");
        }}
        className={`conv-item ${active ? "active" : ""}`}
      >
        <div className="d-flex align-items-center gap-2 overflow-hidden flex-grow-1">
          <span style={{ fontSize: "0.85rem", opacity: active ? 1 : 0.6 }}>
            {c.is_pinned ? "📌" : "💬"}
          </span>
          <span className="conv-title" title={c.title}>
            {c.title || "Untitled Chat"}
          </span>
          {c.unread_count > 0 && (
            <span className="badge bg-danger rounded-pill px-1" style={{ fontSize: "0.65rem" }}>
              {c.unread_count}
            </span>
          )}
        </div>

        <div className="conv-actions">
          <button
            className="conv-icon-btn"
            title={c.is_pinned ? "Unpin chat" : "Pin chat"}
            onClick={(e) => togglePin(c.id, e)}
          >
            {c.is_pinned ? "★" : "☆"}
          </button>
          <button
            className="conv-icon-btn delete"
            title="Delete conversation"
            onClick={(e) => handleDelete(c.id, e)}
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="text-white vh-100 d-flex flex-column justify-content-between" style={{ background: "transparent", width: "280px", minWidth: "280px", maxWidth: "280px" }}>
      
      {/* ================= TOP SECTION ================= */}
      <div className="d-flex flex-column overflow-hidden">
        
        {/* BRAND LOGO HEADER */}
        <div className="p-3 pb-2 d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-10">
          <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => navigate("/chat")}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "linear-gradient(135deg, #00d2ff, #d900ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", boxShadow: "0 0 16px rgba(0, 210, 255, 0.35)" }}>
              ⚡
            </div>
            <div>
              <div className="fw-bold" style={{ fontSize: "1.05rem", letterSpacing: "-0.3px" }}>
                RELEX <span style={{ background: "linear-gradient(135deg, #00d2ff, #d900ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
              </div>
              <div className="text-light-50" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                Multi-Model Studio
              </div>
            </div>
          </div>

          <button
            className="conv-icon-btn d-flex align-items-center justify-content-center"
            title="Collapse Sidebar"
            onClick={onCloseSidebar}
            style={{ width: "32px", height: "32px", fontSize: "1rem", borderRadius: "8px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>


        {/* SEARCH BAR */}
        <div className="sidebar-search-wrapper">
          <span className="sidebar-search-icon">🔍</span>
          <input
            className="sidebar-search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}
              onClick={() => setSearchQuery("")}
            >
              &times;
            </button>
          )}
        </div>

        {/* NEW CHAT BUTTON */}
        <button className="btn-new-chat" onClick={newChat}>
          <span className="d-flex align-items-center gap-2">
            <span>✨</span> New Conversation
          </span>
          <span className="btn-new-chat-badge">+</span>
        </button>

        {/* ADMIN BROADCAST / FEED NOTIFICATION BANNER */}
        {user.role !== "admin" && unreadFeeds.length > 0 && (
          <div className="px-3 mb-2">
            <button
              className="btn btn-sm btn-warning w-100 position-relative fw-bold shadow-sm"
              style={{ borderRadius: "10px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", color: "#ffffff" }}
              onClick={async () => {
                if (!showFeedDropdown) {
                  await markFeedsAsViewed();
                }
                setShowFeedDropdown(prev => !prev);
              }}
            >
              <span>📢 System Broadcasts</span>
              <span className="badge bg-danger position-absolute top-0 start-100 translate-middle rounded-pill">
                {unreadFeeds.length}
              </span>
            </button>

            {showFeedDropdown && (
              <div
                className="bg-dark text-light p-3 mt-2 rounded-3 border border-secondary shadow-lg"
                style={{ maxHeight: "240px", overflowY: "auto", fontSize: "0.82rem" }}
              >
                {feeds.map(f => (
                  <div key={f.id} className="border-bottom border-secondary pb-2 mb-2">
                    <strong className="text-warning">{f.title}</strong>
                    <div className="text-light-50 mt-1">{f.content}</div>
                    <small className="text-muted d-block mt-1">{formatTime(f.created_at)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUICK NAVIGATION SHORTCUTS */}
        <div className="px-3 mb-2">
          <div className="d-flex flex-column gap-1">
            <button
              className="btn btn-sm btn-outline-light text-start w-100 border-0 py-2"
              style={{ borderRadius: "10px", fontSize: "0.82rem", color: "#94a3b8" }}
              onClick={() => navigate("/context")}
            >
              <span>🧠 AI Context & Memory</span>
            </button>

            {user.role === "admin" && (
              <button
                className="btn btn-sm btn-outline-info text-start w-100 border-0 py-2"
                style={{ borderRadius: "10px", fontSize: "0.82rem", color: "#38bdf8" }}
                onClick={() => navigate("/admin/dashboard")}
              >
                <span>📊 Admin Console</span>
              </button>
            )}
          </div>
        </div>

        {/* CONVERSATION LIST */}
        <div className="px-2 flex-grow-1 overflow-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
          
          {/* Pinned Chats Section */}
          {pinnedConvs.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1 text-uppercase text-light-50 fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "1px" }}>
                📌 Pinned ({pinnedConvs.length})
              </div>
              {pinnedConvs.map(renderItem)}
            </div>
          )}

          {/* Recent Chats Section */}
          <div>
            <div className="px-3 py-1 text-uppercase text-light-50 fw-bold" style={{ fontSize: "0.68rem", letterSpacing: "1px" }}>
              Recent Chats
            </div>
            {recentConvs.length === 0 && pinnedConvs.length === 0 ? (
              <div className="text-center text-light-50 py-4 px-3" style={{ fontSize: "0.82rem" }}>
                No chats yet.<br />Click <strong>New Conversation</strong> to begin!
              </div>
            ) : (
              recentConvs.map(renderItem)
            )}
          </div>

        </div>

      </div>

      {/* ================= BOTTOM PROFILE & SETTINGS FOOTER ================= */}
      <div className="sidebar-user-footer">
        <div className="d-flex align-items-center gap-2 overflow-hidden cursor-pointer" onClick={() => setShowSettings(true)}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
            👤
          </div>
          <div className="d-flex flex-column overflow-hidden">
            <span className="fw-bold text-truncate text-white" style={{ maxWidth: "130px", fontSize: "0.84rem" }} title={user.username}>
              {user.username}
            </span>
            <span className="text-light-50 text-uppercase" style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}>
              {user.role}
            </span>
          </div>
        </div>

        <div className="d-flex align-items-center gap-1">
          <button
            className="conv-icon-btn"
            title="Settings"
            onClick={() => setShowSettings(true)}
            style={{ width: "28px", height: "28px" }}
          >
            ⚙️
          </button>
          <button
            className="conv-icon-btn delete"
            title="Logout"
            onClick={() => {
              onLogout();
              navigate("/");
            }}
            style={{ width: "28px", height: "28px" }}
          >
            🚪
          </button>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, backdropFilter: 'blur(10px)' }}>
          <div className="glass-card text-light p-4 position-relative" style={{ width: '460px', maxWidth: '92%', borderRadius: '20px' }}>
            <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setShowSettings(false)}></button>
            <h4 className="fw-bold mb-4" style={{ color: '#00d2ff' }}>⚙️ Application Settings</h4>
            
            <div className="mb-4 bg-dark bg-opacity-50 p-3 rounded-3 border border-secondary border-opacity-25 shadow-sm">
              <label className="text-light-50 small text-uppercase fw-bold">Active User Account</label>
              <div className="fw-bold fs-5 text-light mt-1">{user.username}</div>
              <div className="text-muted small mt-1">Role: <span className="badge bg-info text-dark">{user.role}</span></div>
            </div>

            <div className="mb-4">
              <label className="text-light-50 small text-uppercase mb-2 fw-bold">Appearance</label>
              <div className="d-flex justify-content-between align-items-center bg-dark bg-opacity-50 p-3 rounded-3 border border-secondary border-opacity-25 shadow-sm">
                <span className="fw-bold small">Theme Mode</span>
                <button className={`btn btn-sm fw-bold ${isLightMode ? 'btn-light' : 'btn-dark border border-light'}`} onClick={() => setIsLightMode(!isLightMode)}>
                  {isLightMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-light-50 small text-uppercase mb-2 fw-bold">Preferences</label>
              <div className="bg-dark bg-opacity-50 p-3 rounded-3 border border-secondary border-opacity-25 shadow-sm">
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" id="feature1" checked={smoothAnim} onChange={(e) => setSmoothAnim(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="feature1">Enable Smooth Animations</label>
                </div>
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" id="feature2" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="feature2">High Contrast Mode</label>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="feature3" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="feature3">Auto-scroll chat stream</label>
                </div>
              </div>
            </div>

            <div className="border-top border-secondary border-opacity-25 pt-3 mt-4">
              <button className="btn btn-danger w-100 fw-bold py-2 shadow-sm" onClick={() => { setShowSettings(false); onLogout(); navigate("/"); }}>
                🚪 Secure Logout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
