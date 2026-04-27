import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import PremiumBackground from "../components/PremiumBackground";
import CinematicOverlay from "../components/CinematicOverlay";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/apiClient";

export default function AdminChat() {

const navigate = useNavigate();

const [user, setUser] = useState(null);

const [conversationId, setConversationId] = useState(null);
const [view, setView] = useState("dashboard");

const [users, setUsers] = useState([]);
const [feeds, setFeeds] = useState([]);

const [title, setTitle] = useState("");
const [content, setContent] = useState("");
const [targetUser, setTargetUser] = useState("ALL");

// =========================
// AUTH CHECK
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
}


}, [navigate]);

// =========================
// CLEAR CONTEXT WHEN CHAT CHANGES
// =========================
useEffect(() => {
localStorage.removeItem("ai_context");
}, [conversationId]);

// =========================
// LOAD USERS
// =========================
useEffect(() => {

const loadUsers = async () => {

  try {
    const data = await apiFetch("/admin/users");
    setUsers(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
  }

};

loadUsers();


}, []);

// =========================
// LOAD FEEDS
// =========================
const loadFeeds = async () => {


try {
  const data = await apiFetch("/admin/feeds");
  setFeeds(Array.isArray(data) ? data : []);
} catch (err) {
  console.error(err);
}


};

useEffect(() => {
loadFeeds();
}, []);

// =========================
// POST FEED
// =========================
const postFeed = async () => {


if (!title.trim() || !content.trim()) {
  alert("Title and content required");
  return;
}

try {

  await apiFetch("/admin/feed", {
    method: "POST",
    body: JSON.stringify({
      title,
      content,
      target_user: targetUser
    })
  });

  setTitle("");
  setContent("");
  setTargetUser("ALL");

  await loadFeeds();

  alert("Feed sent successfully");

} catch (err) {
  alert(err.message);
}


};

// =========================
// DELETE FEED
// =========================
const deleteFeed = async (id) => {

try {
  await apiFetch(`/admin/feed/${id}`, { method: "DELETE" });
  loadFeeds();
} catch (err) {
  console.error(err);
}

};

// =========================
// CLEAR ALL FEEDS
// =========================
const clearAllFeeds = async () => {


if (!window.confirm("Clear all feeds?")) return;

try {

  await apiFetch("/admin/feeds/clear", {
    method: "DELETE"
  });

  loadFeeds();

} catch (err) {
  console.error(err);
}


};

const formatTime = (date) => {
return new Date(date).toLocaleString();
};

if (!user) return null;

return ( <div className="admin-page-wrapper">

  <PremiumBackground />
  <CinematicOverlay />

  <div className="ai-signature">
    RELEX<span>AI</span>
  </div>

  <div className="container-fluid position-relative" style={{ zIndex: 5 }}>
    <div className="row vh-100">

      {/* ================= SIDEBAR ================= */}
      <div className="col-3 p-0">

        <Sidebar
          user={user}
          activeConversationId={conversationId}

          onSelect={(id) => {

            if (!id) return;

            setConversationId(id);
            setView("chat");

          }}

          onOpenDashboard={() => {

            // Toggle dashboard open/close
            if (view === "dashboard") {

              if (conversationId) {
                setView("chat");
              }

            } else {

              setConversationId(null);
              setView("dashboard");

            }

          }}

          onLogout={() => {

            localStorage.removeItem("user");
            localStorage.removeItem("lastConversation");
            localStorage.removeItem("ai_context");

            navigate("/");

          }}

        />

      </div>

      {/* ================= MAIN PANEL ================= */}
      <div className="col-9 p-0 d-flex flex-column glass-panel">

        <div className="border-bottom p-3">
          <h5 className="text-info">Admin AI Dashboard</h5>
        </div>

        <div className="flex-grow-1 overflow-auto">

          {/* ================= DASHBOARD ================= */}
          {view === "dashboard" && (

            <div className="p-4">

              {/* POST FEED */}
              <div className="card glass-card mb-4">

                <div className="card-body">

                  <h6 className="text-info">Post New Feed</h6>

                  <input
                    className="form-control mb-2"
                    placeholder="Feed Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <textarea
                    className="form-control mb-2"
                    rows="3"
                    placeholder="Feed Content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />

                  <select
                    className="form-control mb-2"
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                  >
                    <option value="ALL">All Users</option>

                    {users.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.username}
                      </option>
                    ))}

                  </select>

                  <div className="d-flex gap-2">

                    <button
                      className="btn btn-info"
                      onClick={postFeed}
                    >
                      Send Feed
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => {

                        setTitle("");
                        setContent("");
                        setTargetUser("ALL");

                      }}
                    >
                      Clear
                    </button>

                  </div>

                </div>

              </div>

              {/* RECENT FEEDS */}
              <div className="card glass-card">

                <div className="card-body">

                  <div className="d-flex justify-content-between mb-2">

                    <h6 className="text-info">Recent Feeds</h6>

                    <button
                      className="btn btn-sm btn-danger"
                      onClick={clearAllFeeds}
                    >
                      Clear All
                    </button>

                  </div>

                  {feeds.length === 0 && (
                    <div className="text-muted">
                      No feeds available
                    </div>
                  )}

                  {feeds.map((feed) => (

                    <div
                      key={feed.id}
                      className="border rounded p-2 mb-2 bg-dark text-light"
                    >

                      <strong>{feed.title}</strong>

                      <p className="small mb-1">
                        {feed.content}
                      </p>

                      <small className="text-muted">
                        {feed.target_user} | {formatTime(feed.created_at)}
                      </small>

                      <div className="mt-2">

                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteFeed(feed.id)}
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            </div>

          )}

          {/* ================= CHAT ================= */}
          {view === "chat" && conversationId && (

            <div className="h-100">

              <ChatWindow
                user={user}
                conversationId={conversationId}
              />

            </div>

          )}

        </div>

        <div className="flagship-ambient"></div>

      </div>

    </div>
  </div>

</div>


);
}
