import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ContextPanel from "../components/ContextPanel";
import Sidebar from "../components/Sidebar";

export default function ContextPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [contextData, setContextData] = useState(null);
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

  // =========================================
  // LOAD USER + CONTEXT FROM LOCAL STORAGE
  // =========================================
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedContext = localStorage.getItem("ai_context");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("User parse error", err);
      }
    }

    if (storedContext) {
      try {
        setContextData(JSON.parse(storedContext));
      } catch (err) {
        console.error("Context parse error", err);
      }
    }
  }, []);

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

      {/* Sidebar */}
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

      {/* Main Content Area */}
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
              <span style={{ fontSize: "1.2rem" }}>🧠</span>
              <h5 className="mb-0 fw-bold text-white" style={{ letterSpacing: "-0.01em" }}>AI Context Viewer</h5>
            </div>
          </div>

          <button
            className="btn btn-sm btn-outline-light px-3 py-1.5 rounded-pill"
            onClick={() => navigate("/chat")}
            style={{ fontSize: "0.82rem" }}
          >
            ← Back to Chat
          </button>
        </div>

        {/* Context Panel Content */}
        <div className="flex-grow-1 p-4 overflow-auto custom-scrollbar">
          <ContextPanel contextData={contextData} />
        </div>
      </main>
    </div>
  );
}