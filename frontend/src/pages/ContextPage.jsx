import { useEffect, useState } from "react";
import ContextPanel from "../components/ContextPanel";
import Sidebar from "../components/Sidebar";

export default function ContextPage() {

  const [user, setUser] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

        {/* Sidebar */}
        <div className={`glass-sidebar position-absolute position-md-static h-100 z-3 ${sidebarOpen ? "" : "d-none d-md-block"}`} style={{ width: "280px" }}>
          <Sidebar user={user} />
        </div>

        {/* Context Panel */}
        <div className="flex-grow-1 p-4 glass-main d-flex flex-column h-100 overflow-auto">

          <div className="d-flex align-items-center mb-4 gap-3">
            <button
              className="btn btn-sm btn-outline-light d-md-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h4 className="text-info m-0">
              AI Context Viewer
            </h4>
          </div>

          <ContextPanel contextData={contextData} />

        </div>

      </div>

    </div>
  );
}