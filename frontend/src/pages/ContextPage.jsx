import { useEffect, useState } from "react";
import ContextPanel from "../components/ContextPanel";
import Sidebar from "../components/Sidebar";
import PremiumBackground from "../components/PremiumBackground";
import CinematicOverlay from "../components/CinematicOverlay";

export default function ContextPage() {

  const [user, setUser] = useState(null);
  const [contextData, setContextData] = useState(null);

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

      <PremiumBackground />
      <CinematicOverlay />

      <div className="ai-signature">
        RELEX<span>AI</span>
      </div>

      <div className="d-flex position-relative" style={{ zIndex: 5 }}>

        {/* Sidebar */}
        <div className="bg-dark glass-sidebar" style={{ width: "280px" }}>
          <Sidebar user={user} />
        </div>

        {/* Context Panel */}
        <div className="flex-grow-1 p-4 glass-main">

          <h4 className="text-info mb-4">
            AI Context Viewer
          </h4>

          <ContextPanel contextData={contextData} />

        </div>

      </div>

    </div>
  );
}