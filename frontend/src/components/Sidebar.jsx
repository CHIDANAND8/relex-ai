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
  setConvs(Array.isArray(data) ? data : []);

} catch (err) {
  console.error(err);
}


}, [user?.id]);

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

// =====================================================
// UI
// =====================================================

return ( <div className="bg-dark text-white vh-100 d-flex flex-column">


  {/* PROFILE */}
  <div className="p-3 border-bottom">
    <div className="fw-bold d-flex align-items-center gap-2">
      {user.username}
      <span className="badge bg-success">🟢</span>
    </div>
    <small className="text-muted">{user.role}</small>
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

  {/* ADMIN DASHBOARD */}
  {/* ADMIN DASHBOARD */}
{user.role === "admin" && (
  <div className="px-3 mb-2">
    <button
      className="btn btn-warning w-100"
      onClick={() => navigate("/admin")}
    >
      Admin Dashboard
    </button>
  </div>
)}

  {/* NEW CHAT */}
  <div className="px-3 mb-2">
    <button
      className="btn btn-primary w-100"
      onClick={newChat}
    >
      + New Chat
    </button>
  </div>

  {/* AI CONTEXT PAGE */}
  <div className="px-3 mb-3">
    <button
      className="btn btn-outline-info w-100"
      onClick={() => navigate("/context")}
    >
      AI Context
    </button>
  </div>

  {/* CHAT LIST */}
  <div className="px-3 flex-grow-1 overflow-auto">
    {filteredConvs.map(renderItem)}
  </div>

  {/* LOGOUT */}
  <div className="p-3 border-top">
    <button
      className="btn btn-danger w-100"
      onClick={() => {
        onLogout();
        navigate("/");
      }}
    >
      Logout
    </button>
  </div>

</div>

);
}
