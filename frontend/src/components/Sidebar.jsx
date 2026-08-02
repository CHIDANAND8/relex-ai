import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
getConversations,
createConversation,
deleteConversation
} from "../services/api";
import { apiFetch } from "../services/apiClient";

export default function Sidebar({
user,
onSelect = () => {},
activeConversationId,
onOpenDashboard = () => {},
onLogout = () => {},
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

// =====================================================
// FORMAT TIME
// =====================================================

const formatTime = (dateString) => {
if (!dateString) return "";
return new Date(dateString).toLocaleString();
};

// =====================================================
// LOAD CONVERSATIONS
// =====================================================

const loadConversations = useCallback(async () => {
  if (!user?.id) return;
  try {
    const data = await getConversations(user.id);
    const safeData = Array.isArray(data) ? data : [];
    setConvs(safeData);

    if (activeConversationId) {
      const isOwned = safeData.some((c) => c.id === activeConversationId);
      if (!isOwned) {
        onSelect(null);
        localStorage.removeItem("lastConversation");
      }
    }
  } catch (err) {
    console.error(err);
  }
}, [user?.id, activeConversationId, onSelect]);

useEffect(() => {


loadConversations();

const interval = setInterval(loadConversations, 8000);
return () => clearInterval(interval);


}, [loadConversations]);

// =====================================================
// LOAD FEEDS
// =====================================================

const loadFeeds = useCallback(async () => {


if (!user || user.role === "admin") return;

try {

  const data = await apiFetch(`/admin/user-feeds/${user.username}`);

  const safeFeeds = Array.isArray(data) ? data : [];
  setFeeds(safeFeeds);

  const unread = safeFeeds.filter(f => {
    const viewed = JSON.parse(f.viewed_by || "[]");
    return !viewed.includes(user.username);
  });

  setUnreadFeeds(unread);

} catch (err) {
  console.error(err);
}


}, [user]);

useEffect(() => {


loadFeeds();

const interval = setInterval(loadFeeds, 10000);
return () => clearInterval(interval);


}, [loadFeeds]);

// =====================================================
// MARK FEEDS VIEWED
// =====================================================

const markFeedsAsViewed = async () => {


if (!unreadFeeds.length) return;

try {

  await Promise.all(
    unreadFeeds.map(feed =>
      apiFetch(
        `/admin/mark-feed-viewed/${feed.id}/${user.username}`,
        { method: "POST" }
      )
    )
  );

  await loadFeeds();
  setShowFeedDropdown(false);

} catch (err) {
  console.error(err);
}


};

// =====================================================
// NEW CHAT
// =====================================================

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
  console.error(err);
}


};

// =====================================================
// DELETE CHAT
// =====================================================

const handleDelete = async (id, e) => {


e.stopPropagation();

try {

  await deleteConversation(id);

  if (id === activeConversationId) {
    onSelect(null);
  }

  loadConversations();

} catch (err) {
  console.error(err);
}


};

// =====================================================
// PIN / UNPIN
// =====================================================

const togglePin = async (id, e) => {

e.stopPropagation();

try {

  await apiFetch(`/conversation/pin/${id}`, {
    method: "POST"
  });

  loadConversations();

} catch (err) {
  console.error(err);
}


};

// =====================================================
// SEARCH FILTER
// =====================================================

const filteredConvs = convs.filter(c =>
c.title.toLowerCase().includes(searchQuery.toLowerCase())
);

// =====================================================
// RENDER CHAT ITEM
// =====================================================

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
    className="d-flex justify-content-between align-items-center p-2 rounded"
    style={{
      cursor: "pointer",
      backgroundColor: active ? "#343a40" : ""
    }}
  >

    <div className="flex-grow-1">

      <div className="d-flex align-items-center gap-2">

        {c.is_pinned && <span>📌</span>}

        <span>{c.title}</span>

        {c.unread_count > 0 && (
          <span className="badge bg-danger">
            {c.unread_count}
          </span>
        )}

      </div>

      <small className="text-muted">
        {formatTime(c.created_at)}
      </small>

    </div>

    {hoveredId === c.id && (

      <div className="d-flex gap-1">

        <button
          className="btn btn-sm btn-outline-warning"
          onClick={(e) => togglePin(c.id, e)}
        >
          📌
        </button>

        <button
          className="btn btn-sm btn-danger"
          onClick={(e) => handleDelete(c.id, e)}
        >
          ×
        </button>

      </div>

    )}

  </div>
);


};

if (!user) return null;

const getProvider = () => {
  if (user.provider) return user.provider;
  const email = (user.username || "").toLowerCase();
  if (email.includes("google") || email.endsWith("@gmail.com")) return "google";
  if (email.includes("facebook") || email.endsWith("@facebook.com") || email.includes("fb_")) return "facebook";
  return "standard";
};

const provider = getProvider();

// =====================================================
// UI
// =====================================================

return ( <div className="text-white vh-100 d-flex flex-column" style={{ background: "transparent" }}>


  {/* PROFILE */}
  <div className="p-3 border-bottom">
    <div className="profile-pill-container d-flex align-items-center gap-3">
      <div className={`provider-avatar ${provider === "google" ? "provider-avatar-google" : provider === "facebook" ? "provider-avatar-facebook" : ""}`}>
        {provider === "google" && (
          <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
        )}
        {provider === "facebook" && (
          <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
          </svg>
        )}
        {provider === "standard" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-light-50">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
        <span className="status-indicator-light"></span>
      </div>
      <div className="d-flex flex-column overflow-hidden">
        <span className="fw-bold text-truncate text-white small" style={{ maxWidth: '170px' }} title={user.username}>
          {user.username}
        </span>
        <span className="text-light-50" style={{ fontSize: '0.75rem' }}>{user.role}</span>
      </div>
    </div>
  </div>

  {/* SEARCH */}
  <div className="p-3">
    <input
      className="form-control form-control-sm"
      placeholder="🔍 Search chat..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>

  {/* FEED NOTIFICATIONS */}
  {user.role !== "admin" && unreadFeeds.length > 0 && (

    <div className="px-3 mb-2">

      <button
        className="btn btn-sm btn-warning w-100 position-relative"
        onClick={async () => {

          if (!showFeedDropdown) {
            await markFeedsAsViewed();
          }

          setShowFeedDropdown(prev => !prev);

        }}
      >
        🔔 New Feed

        <span className="badge bg-danger position-absolute top-0 start-100 translate-middle">
          {unreadFeeds.length}
        </span>

      </button>

      {showFeedDropdown && (

        <div
          className="bg-light text-dark p-2 mt-2 rounded shadow-sm"
          style={{ maxHeight: "220px", overflowY: "auto" }}
        >

          {feeds.map(f => (

            <div key={f.id} className="border-bottom mb-2 pb-2">

              <strong>{f.title}</strong>

              <div className="small">
                {f.content}
              </div>

              <small className="text-muted">
                {formatTime(f.created_at)}
              </small>

            </div>

          ))}

        </div>

      )}

    </div>

  )}

  {/* QUICK LINKS & ACTIONS */}
  <div className="px-3 mb-3">
    <div className="d-flex flex-column gap-1">
      <button className="btn btn-outline-primary text-start w-100 fw-bold border-0" onClick={newChat}>
        💬 New Chat
      </button>
      <button className="btn btn-outline-warning text-start w-100 fw-bold border-0" onClick={() => navigate("/context")}>
        🧠 AI Memory
      </button>
      


      {user.role === "admin" && (
        <button className="btn btn-outline-danger text-start w-100 fw-bold border-0" onClick={() => navigate("/admin/dashboard")}>
          📊 View Dashboard
        </button>
      )}

      <button className="btn btn-outline-light text-start w-100 fw-bold border-0" onClick={() => setShowSettings(true)}>
        ⚙️ Settings
      </button>
    </div>
  </div>

  {/* CHAT LIST */}
  <div className="px-3 flex-grow-1 overflow-auto">
    {filteredConvs.map(renderItem)}
  </div>

  {/* LOGOUT */}
  <div className="p-3 border-top border-secondary">
    <button
      className="btn btn-danger w-100 fw-bold"
      onClick={() => {
        onLogout();
        navigate("/");
      }}
    >
      🚪 Logout
    </button>
  </div>

  {/* SETTINGS MODAL */}
  {showSettings && (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
      <div className="glass-card text-light p-4 position-relative" style={{ width: '450px', maxWidth: '90%' }}>
        <button className="btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={() => setShowSettings(false)}></button>
        <h4 className="fw-bold mb-4 text-info">⚙️ Application Settings</h4>
        
        <div className="mb-4 bg-dark p-3 rounded border border-secondary shadow-sm">
          <label className="text-light-50 small text-uppercase fw-bold">Logged in as</label>
          <div className="fw-bold fs-4 text-light">{user.username}</div>
          <div className="text-muted small">Role: <span className="badge bg-info text-dark">{user.role}</span></div>
        </div>

        <div className="mb-4">
          <label className="text-light-50 small text-uppercase mb-2 fw-bold">Appearance</label>
          <div className="d-flex justify-content-between align-items-center bg-dark p-3 rounded border border-secondary shadow-sm">
            <span className="fw-bold">Theme Mode</span>
            <button className={`btn btn-sm fw-bold ${isLightMode ? 'btn-light' : 'btn-dark border border-light'}`} onClick={() => setIsLightMode(!isLightMode)}>
              {isLightMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-light-50 small text-uppercase mb-2 fw-bold">Chat UI Modifications</label>
          <div className="bg-dark p-3 rounded border border-secondary shadow-sm">
            <div className="form-check form-switch mb-3">
              <input className="form-check-input" type="checkbox" id="feature1" checked={smoothAnim} onChange={(e) => setSmoothAnim(e.target.checked)} />
              <label className="form-check-label" htmlFor="feature1">Enable Smooth Animations</label>
            </div>
            <div className="form-check form-switch mb-3">
              <input className="form-check-input" type="checkbox" id="feature2" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
              <label className="form-check-label" htmlFor="feature2">High Contrast Chat</label>
            </div>
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" id="feature3" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              <label className="form-check-label" htmlFor="feature3">Auto-scroll to latest message</label>
            </div>
          </div>
        </div>

        <div className="border-top border-secondary pt-3 mt-4">
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
