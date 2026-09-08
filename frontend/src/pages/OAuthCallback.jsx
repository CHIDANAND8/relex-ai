import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { oauthCallback } from "../services/api";

export default function OAuthCallback() {
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state") || "google";
      const errorParam = params.get("error");
      const errorDescription = params.get("error_description");

      if (errorParam) {
        setError(errorDescription || `OAuth provider access error: ${errorParam}`);
        return;
      }

      if (!code) {
        setError("Authorization code is missing from OAuth response.");
        return;
      }

      try {
        const data = await oauthCallback({
          provider: state,
          code: code,
          redirectUri: window.location.origin + "/oauth/callback"
        });

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
        console.error("OAuth authentication error:", err);
        setError(err.message || "Failed to authenticate with OAuth provider.");
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="auth-page-wrapper d-flex flex-column align-items-center justify-content-center text-white" style={{ minHeight: "100vh" }}>
      <div className="auth-card text-center p-5" style={{ maxWidth: "480px" }}>
        {error ? (
          <>
            <div className="text-danger mb-3" style={{ fontSize: "3rem" }}>⚠️</div>
            <h3 className="text-danger fw-bold mb-3">Authentication Failed</h3>
            <div className="alert alert-danger py-2 text-start small mb-4" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)", color: "#fca5a5" }}>
              {error}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-light flex-fill" onClick={() => navigate("/signup")}>
                Try Signup Again
              </button>
              <button className="btn btn-info flex-fill" onClick={() => navigate("/")}>
                Return to Login
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="spinner-border text-info mb-4" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h3 className="auth-font-title mb-2">Connecting Account</h3>
            <p className="text-light-50 small mb-0">Verifying secure OAuth credentials with Google. Please wait...</p>
          </>
        )}
      </div>
    </div>
  );
}

