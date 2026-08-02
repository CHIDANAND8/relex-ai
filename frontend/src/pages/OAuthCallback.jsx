import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OAuthCallback() {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state") || "google";

      if (!code) {
        setError("Authorization code is missing.");
        return;
      }

      try {
        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/auth/oauth-callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: state,
            code: code,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Authentication failed");
        }

        const data = await res.json();
        
        // Save session
        localStorage.removeItem("lastConversation");
        localStorage.setItem("user", JSON.stringify(data));

        // Role-based redirect
        if (data.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/chat");
        }
      } catch (err) {
        console.error("OAuth error:", err);
        setError(err.message || "Failed to log in with social provider.");
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="auth-page-wrapper d-flex flex-column align-items-center justify-content-center text-white" style={{ minHeight: "100vh" }}>
      <div className="auth-card text-center p-5" style={{ maxWidth: "450px" }}>
        {error ? (
          <>
            <h3 className="text-danger mb-4">🔑 Authentication Failed</h3>
            <p className="text-light-50 small mb-4">{error}</p>
            <button className="btn btn-outline-light w-100" onClick={() => navigate("/")}>
              Return to Login
            </button>
          </>
        ) : (
          <>
            <div className="spinner-border text-info mb-4" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h3 className="auth-font-title mb-2">Connecting Account</h3>
            <p className="text-light-50 small mb-0">Verifying secure OAuth credentials. Please wait...</p>
          </>
        )}
      </div>
    </div>
  );
}
