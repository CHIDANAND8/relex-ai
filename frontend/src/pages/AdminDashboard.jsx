import Sidebar from "../components/Sidebar";


import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/apiClient";
import { uploadAdminFeedDocument } from "../services/api";

export default function AdminDashboard() {

const navigate = useNavigate();

const [user, setUser] = useState(null);
const [sidebarOpen, setSidebarOpen] = useState(true);

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
    const stored = localStorage.getItem("user");
    let username = "";
    if (stored) {
      const u = JSON.parse(stored);
      username = u.username;
    }
    const data = await apiFetch(`/admin/feeds?username=${encodeURIComponent(username)}`);
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
      
      // Pass the feed body content too if provided
      if (content.trim()) {
        formData.append("content", content);
      }
      
      formData.append("target_user", targetUser);
      formData.append("created_by", user.username);

      await uploadAdminFeedDocument(formData);
  } else {
      await apiFetch("/admin/feed", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          target_user: targetUser,
          created_by: user.username
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

  await apiFetch(`/admin/feeds/clear?username=${encodeURIComponent(user.username)}`, {
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

  {/* Clean Background */}

  <div className="d-flex position-relative" style={{ zIndex: 5 }}>

    {/* SIDEBAR */}
    <div className={`glass-sidebar ${sidebarOpen ? "" : "d-none d-md-block"}`} style={{ width: "280px" }}>
      <Sidebar user={user} />
    </div>

    {/* DASHBOARD PANEL */}
    <div className="flex-grow-1 d-flex flex-column vh-100 glass-main">
      
      <div className="border-bottom p-2 d-flex justify-content-between align-items-center glass-header">
        <button
          className="btn btn-sm btn-outline-light d-md-none"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
        <button className="btn btn-danger px-4 rounded fw-bold shadow-sm" onClick={() => {
            localStorage.removeItem("user");
            navigate("/");
        }}>Log Out</button>
      </div>

      <div className="flex-grow-1 overflow-auto p-4">
        <h3 className="text-info fw-bold mb-4">Admin Control Center</h3>

      {/* QUICK STATS */}
      <div className="row g-4 mb-5">
        <div className="col-md-4">
          <div className="glass-card text-center py-4">
            <h6 className="text-light-50 text-uppercase tracking-wider mb-2">Total Users</h6>
            <h2 className="text-info fw-bold mb-0 display-4">{users.length}</h2>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-card text-center py-4">
            <h6 className="text-light-50 text-uppercase tracking-wider mb-2">Active Feeds</h6>
            <h2 className="text-warning fw-bold mb-0 display-4">{feeds.length}</h2>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-card text-center py-4">
            <h6 className="text-light-50 text-uppercase tracking-wider mb-2">System Status</h6>
            <h2 className="text-success fw-bold mb-0 display-4">Online</h2>
          </div>
        </div>
      </div>

      {/* REGISTERED USERS & ADMINS LIST */}
      <div className="card glass-card mb-5">
        <div className="card-body">
          <h5 className="text-info fw-bold mb-3">Registered Users & Admins</h5>
          <div className="table-responsive">
            <table className="table table-borderless text-light align-middle mb-0" style={{ backgroundColor: 'transparent', '--bs-table-bg': 'transparent', color: '#ececec' }}>
              <thead>
                <tr className="border-bottom border-secondary text-light-50 fs-6">
                  <th>Username / Email</th>
                  <th>Role / Account Type</th>
                  <th>Registration Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const regDate = u.created_at ? new Date(u.created_at) : new Date();
                  const formattedDate = regDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedTime = regDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                  
                  // Normalize role label
                  const isRoleAdmin = String(u.role).toLowerCase() === "admin" || String(u.role).toLowerCase() === "administrator";
                  const roleLabel = isRoleAdmin ? "Admin" : "User";
                  
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <td className="fw-bold fs-6 text-white">{u.username}</td>
                      <td>
                        {isRoleAdmin ? (
                          <span className="badge bg-danger text-uppercase px-2.5 py-1.5" style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}>Admin</span>
                        ) : (
                          <span className="badge bg-secondary text-uppercase px-2.5 py-1.5" style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}>User</span>
                        )}
                      </td>
                      <td className="text-light-50">
                        {formattedDate} at {formattedTime}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* POST FEED */}
        <div className="col-lg-5">
          <div className="glass-card h-100">

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

        </div>
        
        {/* RECENT FEEDS */}
        <div className="col-lg-7">
          <div className="glass-card h-100">

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
    </div>
  </div>
</div>

);
}
