import Sidebar from "../components/Sidebar";
import PremiumBackground from "../components/PremiumBackground";
import CinematicOverlay from "../components/CinematicOverlay";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/apiClient";
import { uploadAdminFeedDocument } from "../services/api";

export default function AdminDashboard() {

const navigate = useNavigate();

const [user, setUser] = useState(null);

const [users, setUsers] = useState([]);
const [feeds, setFeeds] = useState([]);

const [title, setTitle] = useState("");
const [content, setContent] = useState("");
const [targetUser, setTargetUser] = useState("ALL");
const [feedFile, setFeedFile] = useState(null);
const [isUploading, setIsUploading] = useState(false);

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
  setUser(JSON.parse(stored));
} catch {
  navigate("/");
}


}, [navigate]);

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

if (!title.trim()) {
  alert("Feed Title is required");
  return;
}

if (!content.trim() && !feedFile) {
  alert("Must provide either a text body or attach a document");
  return;
}

setIsUploading(true);

try {

  if (feedFile) {
      const formData = new FormData();
      formData.append("file", feedFile);
      formData.append("title", title);
      formData.append("target_user", targetUser);

      await uploadAdminFeedDocument(formData);
  } else {
      await apiFetch("/admin/feed", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          target_user: targetUser
        })
      });
  }

  setTitle("");
  setContent("");
  setTargetUser("ALL");
  setFeedFile(null);
  
  const fileInput = document.getElementById("adminFeedFileInput");
  if (fileInput) fileInput.value = "";

  loadFeeds();

} catch (err) {
  alert(err.message);
} finally {
  setIsUploading(false);
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
// CLEAR FEEDS
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

const formatTime = (date) => new Date(date).toLocaleString();

if (!user) return null;

return ( <div className="user-page-wrapper">

  <PremiumBackground />
  <CinematicOverlay />

  <div className="ai-signature">
    RELEX<span>AI</span>
  </div>

  <div className="d-flex position-relative" style={{ zIndex: 5 }}>

    {/* SIDEBAR */}
    <div className="bg-dark glass-sidebar" style={{ width: "280px" }}>
      <Sidebar user={user} />
    </div>

    {/* DASHBOARD PANEL */}
    <div className="flex-grow-1 p-4 glass-main">

      <h4 className="text-warning mb-4">
        Admin Dashboard
      </h4>

      {/* POST FEED */}
      <div className="card mb-4">

        <div className="card-body">

          <h6>Post New Feed</h6>

          <input
            className="form-control mb-2"
            placeholder="Feed Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            className="form-control mb-2"
            rows="3"
            placeholder={feedFile ? "Document attached. Raw text feed disabled." : "Feed Content"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!!feedFile}
          />

          <input 
            type="file" 
            className="form-control mb-2" 
            id="adminFeedFileInput"
            accept=".pdf,.txt,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
            onChange={(e) => setFeedFile(e.target.files?.[0] || null)}
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

          <button
            className="btn btn-warning w-100 fw-bold"
            onClick={postFeed}
            disabled={isUploading}
          >
            {isUploading ? "Uploading OCR Document..." : "Send Feed"}
          </button>

        </div>

      </div>

      {/* RECENT FEEDS */}
      <div className="card">

        <div className="card-body">

          <div className="d-flex justify-content-between mb-3">

            <h6>Recent Feeds</h6>

            <button
              className="btn btn-danger btn-sm"
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

          {feeds.map(feed => (

            <div
              key={feed.id}
              className="border p-2 mb-2 rounded"
            >

              <strong>{feed.title}</strong>

              <div className="small">
                {feed.content}
              </div>

              <small className="text-muted">
                {feed.target_user} | {formatTime(feed.created_at)}
              </small>

              <div className="mt-2">

                <button
                  className="btn btn-outline-danger btn-sm"
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

  </div>

</div>

);
}
