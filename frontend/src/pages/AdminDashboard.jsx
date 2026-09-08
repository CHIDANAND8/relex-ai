import Sidebar from "../components/Sidebar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/apiClient";
import { uploadAdminFeedDocument } from "../services/api";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar_open");
    if (saved !== null) return saved === "true";
    return window.innerWidth >= 768;
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_open", String(next));
      return next;
    });
  };

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

  return (
    <div className="user-page-wrapper">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="d-md-none position-fixed top-0 start-0 w-100 h-100"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", zIndex: 1040 }}
          onClick={toggleSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`glass-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <Sidebar
          user={user}
          onLogout={() => {
            localStorage.removeItem("user");
            localStorage.removeItem("lastConversation");
            localStorage.removeItem("ai_context");
            navigate("/");
          }}
          onCloseSidebar={toggleSidebar}
        />
      </aside>

      {/* DASHBOARD PANEL */}
      <main className="glass-main flex-grow-1 d-flex flex-column vh-100 overflow-hidden">
        <div className="glass-header d-flex justify-content-between align-items-center position-relative" style={{ zIndex: 100 }}>
          <div className="d-flex align-items-center gap-3">
            <button
              className="btn btn-sm d-flex align-items-center gap-1.5 p-1 px-2 rounded-3"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              style={{
                height: "36px",
                background: sidebarOpen ? "rgba(255, 255, 255, 0.05)" : "linear-gradient(135deg, rgba(0, 210, 255, 0.2), rgba(217, 0, 255, 0.15))",
                border: sidebarOpen ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 210, 255, 0.5)",
                color: sidebarOpen ? "#cbd5e1" : "#00d2ff",
                boxShadow: sidebarOpen ? "none" : "0 0 16px rgba(0, 210, 255, 0.4)",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                {sidebarOpen ? (
                  <polyline points="15 15 12 12 15 9"/>
                ) : (
                  <polyline points="12 9 15 12 12 15"/>
                )}
              </svg>
              {!sidebarOpen && (
                <span className="fw-bold" style={{ fontSize: "0.78rem", letterSpacing: "0.3px", paddingRight: "2px" }}>
                  Sidebar
                </span>
              )}
            </button>
            <div className="d-flex align-items-center gap-2">
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(217, 0, 255, 0.2) 100%)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444"
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <h5 className="mb-0 fw-bold text-white" style={{ letterSpacing: "-0.01em" }}>Admin Control Center</h5>
                <span className="text-light-50" style={{ fontSize: "0.75rem" }}>System Governance & Live Broadcasts</span>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="d-none d-sm-flex align-items-center gap-2 px-3 py-1.5 rounded-pill" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }}></span>
              <span style={{ color: "#10b981", fontSize: "0.78rem", fontWeight: 600 }}>System Live</span>
            </div>
            <button 
              className="btn btn-sm btn-outline-danger px-3 py-1.5 rounded-pill" 
              onClick={() => {
                localStorage.removeItem("user");
                navigate("/");
              }}
              style={{ fontSize: "0.82rem" }}
            >
              Log Out
            </button>
          </div>
        </div>

        <div className="flex-grow-1 overflow-auto p-4 custom-scrollbar">
          {/* QUICK STATS */}
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="glass-card h-100 d-flex flex-column justify-content-between p-4 position-relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(0, 210, 255, 0.05) 0%, rgba(18, 16, 32, 0.8) 100%)", border: "1px solid rgba(0, 210, 255, 0.2)" }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-light-50 text-uppercase fw-semibold" style={{ fontSize: "0.75rem", letterSpacing: "0.08em" }}>Total Users</span>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(0, 210, 255, 0.1)", color: "#00d2ff" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                </div>
                <div className="d-flex align-items-baseline gap-2">
                  <h2 className="fw-bold mb-0 text-white" style={{ fontSize: "2.4rem", letterSpacing: "-0.02em" }}>{users.length}</h2>
                  <span className="text-light-50" style={{ fontSize: "0.82rem" }}>accounts</span>
                </div>
                <div className="mt-3 pt-2 border-top border-secondary border-opacity-10" style={{ fontSize: "0.75rem", color: "var(--accent-cyan)" }}>
                  ● Active SQLite & OAuth Directory
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="glass-card h-100 d-flex flex-column justify-content-between p-4 position-relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(18, 16, 32, 0.8) 100%)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-light-50 text-uppercase fw-semibold" style={{ fontSize: "0.75rem", letterSpacing: "0.08em" }}>Active Feeds</span>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 11a9 9 0 0 1 9 9"/>
                      <path d="M4 4a16 16 0 0 1 16 16"/>
                      <circle cx="5" cy="19" r="1"/>
                    </svg>
                  </div>
                </div>
                <div className="d-flex align-items-baseline gap-2">
                  <h2 className="fw-bold mb-0 text-white" style={{ fontSize: "2.4rem", letterSpacing: "-0.02em" }}>{feeds.length}</h2>
                  <span className="text-light-50" style={{ fontSize: "0.82rem" }}>broadcasts</span>
                </div>
                <div className="mt-3 pt-2 border-top border-secondary border-opacity-10" style={{ fontSize: "0.75rem", color: "#f59e0b" }}>
                  ● Real-time user feed stream
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="glass-card h-100 d-flex flex-column justify-content-between p-4 position-relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(18, 16, 32, 0.8) 100%)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-light-50 text-uppercase fw-semibold" style={{ fontSize: "0.75rem", letterSpacing: "0.08em" }}>Core Engine</span>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                </div>
                <div className="d-flex align-items-baseline gap-2">
                  <h2 className="fw-bold mb-0 text-white" style={{ fontSize: "2.2rem", letterSpacing: "-0.02em" }}>FastAPI</h2>
                  <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25" style={{ fontSize: "0.72rem" }}>Healthy</span>
                </div>
                <div className="mt-3 pt-2 border-top border-secondary border-opacity-10" style={{ fontSize: "0.75rem", color: "#10b981" }}>
                  ● Llama 3.3 + Chroma RAG active
                </div>
              </div>
            </div>
          </div>

          {/* USER MANAGEMENT TABLE */}
          <div className="glass-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold text-white mb-1">User Management</h5>
                <span className="text-light-50" style={{ fontSize: "0.8rem" }}>Registered platform accounts</span>
              </div>
              <span className="badge rounded-pill" style={{ background: "rgba(255,255,255,0.08)", color: "#cbd5e1", fontSize: "0.75rem" }}>
                {users.length} Registered
              </span>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Details</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => {
                    const isRoleAdmin = u.role === "admin";
                    const formattedDate = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                    const formattedTime = u.created_at ? new Date(u.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                    return (
                      <tr 
                        key={u.id}
                        style={{ 
                          borderBottom: index !== users.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                          background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              background: isRoleAdmin ? "rgba(239, 68, 68, 0.15)" : "rgba(0, 210, 255, 0.15)",
                              border: `1px solid ${isRoleAdmin ? "rgba(239, 68, 68, 0.3)" : "rgba(0, 210, 255, 0.3)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.88rem",
                              color: isRoleAdmin ? "#f87171" : "#38bdf8"
                            }}>
                              {(u.username || "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="fw-semibold text-white" style={{ fontSize: "0.92rem" }}>{u.username}</div>
                              <div className="text-light-50" style={{ fontSize: "0.75rem" }}>ID: #{u.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {isRoleAdmin ? (
                            <span style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase"
                            }}>
                              Admin
                            </span>
                          ) : (
                            <span style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: "rgba(59, 130, 246, 0.12)",
                              color: "#60a5fa",
                              border: "1px solid rgba(59, 130, 246, 0.25)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase"
                            }}>
                              User
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
                          {formattedDate} <span style={{ opacity: 0.6 }}>at {formattedTime}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="row g-4">
            {/* POST FEED */}
            <div className="col-lg-5">
              <div className="glass-card h-100 p-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  </div>
                  <h5 className="fw-bold text-white mb-0">Create Broadcast</h5>
                </div>

                <div className="mb-3">
                  <label className="form-label text-light-50" style={{ fontSize: "0.8rem", fontWeight: 600 }}>FEED TITLE</label>
                  <input
                    className="form-control"
                    placeholder="e.g. System Maintenance Notice"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-light-50" style={{ fontSize: "0.8rem", fontWeight: 600 }}>MESSAGE BODY</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder={feedFile ? "Document attached. Raw text message disabled." : "Enter broadcast details..."}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={!!feedFile}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-light-50" style={{ fontSize: "0.8rem", fontWeight: 600 }}>ATTACH DOCUMENT (OPTIONAL OCR / RAG)</label>
                  <input 
                    type="file" 
                    className="form-control" 
                    id="adminFeedFileInput"
                    accept=".pdf,.txt,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
                    onChange={(e) => setFeedFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-light-50" style={{ fontSize: "0.8rem", fontWeight: 600 }}>TARGET AUDIENCE</label>
                  <select
                    className="form-select"
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                  >
                    <option value="ALL">All Platform Users (Global Broadcast)</option>
                    {users.map((u) => (
                      <option key={u.username} value={u.username}>
                        User: {u.username}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn btn-primary w-100 py-2.5 mt-2"
                  onClick={postFeed}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Uploading Document...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Publish Feed
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* RECENT FEEDS */}
            <div className="col-lg-7">
              <div className="glass-card h-100 p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="fw-bold text-white mb-0">Published Feeds</h5>
                    <span className="badge rounded-pill" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "0.75rem" }}>
                      {feeds.length}
                    </span>
                  </div>

                  {feeds.length > 0 && (
                    <button
                      className="btn btn-outline-danger btn-sm px-2.5 py-1"
                      onClick={clearAllFeeds}
                      style={{ fontSize: "0.78rem" }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="flex-grow-1 overflow-auto custom-scrollbar" style={{ maxHeight: "380px" }}>
                  {feeds.length === 0 ? (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-center text-light-50">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div>No feeds published yet.</div>
                    </div>
                  ) : (
                    feeds.map(feed => (
                      <div
                        key={feed.id}
                        className="p-3 mb-2 rounded-3"
                        style={{
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <strong className="text-white" style={{ fontSize: "0.95rem" }}>{feed.title}</strong>
                          <button
                            className="btn btn-sm btn-link text-danger p-0 ms-2"
                            onClick={() => deleteFeed(feed.id)}
                            title="Delete this feed"
                            style={{ textDecoration: "none" }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>

                        {feed.content && (
                          <div className="text-light-50 mb-2" style={{ fontSize: "0.85rem", lineHeight: "1.4" }}>
                            {feed.content}
                          </div>
                        )}

                        <div className="d-flex justify-content-between align-items-center" style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          <span className="badge" style={{ background: "rgba(0, 210, 255, 0.1)", color: "#38bdf8", border: "1px solid rgba(0, 210, 255, 0.2)" }}>
                            Target: {feed.target_user}
                          </span>
                          <span>{formatTime(feed.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
