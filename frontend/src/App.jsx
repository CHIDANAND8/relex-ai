import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import UserChat from "./pages/UserChat";
import OAuthCallback from "./pages/OAuthCallback";

import ContextPage from "./pages/ContextPage";   // ✅ NEW
import AdminDashboard from "./pages/AdminDashboard";
import SharedChatPage from "./pages/SharedChatPage";

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const applySettings = () => {
       const theme = localStorage.getItem('theme');
       if (theme === 'light') document.body.classList.add('light-mode');
       else document.body.classList.remove('light-mode');

       const hc = localStorage.getItem('highContrast');
       if (hc === 'true') document.body.classList.add('high-contrast');
       else document.body.classList.remove('high-contrast');

       const sa = localStorage.getItem('smoothAnim');
       if (sa === 'false') document.body.classList.add('no-animations');
       else document.body.classList.remove('no-animations');
    };

    applySettings();
    window.addEventListener('settingsChanged', applySettings);
    window.addEventListener('storage', applySettings);

    return () => {
        window.removeEventListener('settingsChanged', applySettings);
        window.removeEventListener('storage', applySettings);
    };
  }, []);

  // Monitor auth state to start Websocket listen
  useEffect(() => {
    const checkRole = () => {
      try {
        const u = localStorage.getItem("user");
        if (u) {
          const parsed = JSON.parse(u);
          setIsAdmin(parsed.role === "admin");
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
      }
    };
    checkRole();
    const interval = setInterval(checkRole, 2000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket Listener Hook
  useEffect(() => {
    if (!isAdmin) {
      setToasts([]);
      return;
    }

    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws/notifications");

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const newToast = {
            id: Date.now() + Math.random(),
            message: payload.message,
            type: payload.type === "USER_SIGNUP" ? "user-signup" : "feed-created"
          };
          setToasts((prev) => [...prev, newToast]);
        } catch (err) {
          console.error("Payload read error:", err);
        }
      };

      ws.onclose = () => {
        // Try reconnecting in 5s
        setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.error("Notification WS connection error:", err);
        ws.close();
      };
    };

    connectWS();
  }, [isAdmin]);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <BrowserRouter>
      {/* Toast Alert Canvas */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`glass-toast ${t.type}`}>
              <div className="toast-icon">
                {t.type === "user-signup" ? "👤" : "📢"}
              </div>
              <div className="toast-content">
                <div className="toast-message">{t.message}</div>
              </div>
              <button className="toast-close" onClick={() => dismissToast(t.id)}>
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <Routes>
        {/* AUTH */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* USER */}
        <Route path="/chat" element={<UserChat />} />

        {/* ADMIN */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* AI CONTEXT PAGE */}
        <Route path="/context" element={<ContextPage />} />  {/* ✅ NEW */}

        {/* SHARED CHAT */}
        <Route path="/share/:uuid" element={<SharedChatPage />} />

        {/* SOCIAL OAUTH CALLBACK */}
        <Route path="/oauth/callback" element={<OAuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;