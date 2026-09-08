import { useState } from "react";
import { login } from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";

const RelexEmblem = () => (
  <svg width="42" height="42" viewBox="0 0 200 200" style={{ overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="emblemNeonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00d2ff" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#d900ff" />
      </linearGradient>
      <filter id="emblemNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComponentTransfer in="blur" result="glow1">
          <feFuncA type="linear" slope="0.7"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode in="glow1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <path d="M 60 170 A 85 85 0 1 1 180 120" fill="none" stroke="url(#emblemNeonGrad)" strokeWidth="8" strokeLinecap="round" filter="url(#emblemNeonGlow)" />
    <path d="M 78 55 L 78 150" stroke="url(#emblemNeonGrad)" strokeWidth="22" strokeLinecap="round" filter="url(#emblemNeonGlow)" />
    <path d="M 78 66 C 135 66, 135 116, 78 116" stroke="url(#emblemNeonGrad)" strokeWidth="22" strokeLinecap="round" filter="url(#emblemNeonGlow)" />
    <path d="M 100 114 L 140 152" stroke="url(#emblemNeonGrad)" strokeWidth="22" strokeLinecap="round" filter="url(#emblemNeonGlow)" />
    <circle cx="110" cy="88" r="4" fill="#00d2ff" filter="url(#emblemNeonGlow)" />
  </svg>
);

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configModalProvider, setConfigModalProvider] = useState("");

  const navigate = useNavigate();

  // ⚡ Quick Fill Demo Credentials Handler
  const handleQuickFill = (demoRole) => {
    setError("");
    if (demoRole === "admin") {
      setUsername("admin");
      setPassword("Admin@1234");
    } else {
      setUsername("demo_user");
      setPassword("User@1234");
    }
  };

  // Social OAuth Handler
  const handleSocialLogin = (provider) => {
    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const facebookClientId = process.env.REACT_APP_FACEBOOK_CLIENT_ID;

    const isGooglePlaceholder = !googleClientId || googleClientId === "YOUR_GOOGLE_CLIENT_ID" || googleClientId.trim() === "";
    const isFacebookPlaceholder = !facebookClientId || facebookClientId === "YOUR_FACEBOOK_CLIENT_ID" || facebookClientId.trim() === "";

    if (provider === "google") {
      if (isGooglePlaceholder) {
        setConfigModalProvider("google");
        setShowConfigModal(true);
        return;
      }
      const redirectUri = encodeURIComponent(window.location.origin + "/oauth/callback");
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${redirectUri}&scope=openid%20email%20profile&state=google`;
    } else {
      if (isFacebookPlaceholder) {
        setConfigModalProvider("facebook");
        setShowConfigModal(true);
        return;
      }
      const redirectUri = encodeURIComponent(window.location.origin + "/oauth/callback");
      window.location.href = `https://www.facebook.com/v12.0/dialog/oauth?response_type=code&client_id=${facebookClientId}&redirect_uri=${redirectUri}&scope=email,public_profile&state=facebook`;
    }
  };

  // Submit Login Handler
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setError("");

    if (!username.trim()) {
      setError("Please enter your username or email");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    try {
      setLoading(true);

      const data = await login({
        username: username.trim(),
        password
      });

      // Save session
      localStorage.removeItem("lastConversation");
      localStorage.setItem("user", JSON.stringify(data));

      // Role-based navigation
      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/chat");
      }

    } catch (err) {
      setError(err.message || "Invalid credentials. Please verify your username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root-wrapper">
      <div className="auth-cyber-grid"></div>
      <div className="auth-ambient-orb auth-ambient-orb-1"></div>
      <div className="auth-ambient-orb auth-ambient-orb-2"></div>

      <div className="auth-main-container">
        
        {/* ================= HERO SHOWCASE PANE (LEFT) ================= */}
        <div className="auth-hero-pane">
          <div>
            <div className="auth-hero-tag">
              <span>⚡</span> Next-Gen AI Assistant
            </div>
            <h1 className="auth-hero-title">
              Intelligent Workspace for <span>Deep Analysis</span> & Creation.
            </h1>
            <p className="auth-hero-desc">
              Experience seamless multi-model LLMs (Llama 3.3 70B, Mixtral, Gemma 2), RAG document search, and real-time collaboration feeds in one high-performance interface.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature-card">
                <div className="auth-feature-icon">🧠</div>
                <div className="auth-feature-text">
                  <h6>Groq Multi-Model Intelligence</h6>
                  <p>Switch dynamically between reasoning and speed-optimized models.</p>
                </div>
              </div>

              <div className="auth-feature-card">
                <div className="auth-feature-icon">📚</div>
                <div className="auth-feature-text">
                  <h6>Vector RAG Document Context</h6>
                  <p>Instant PDF, Word, and text document indexing and Q&A analysis.</p>
                </div>
              </div>

              <div className="auth-feature-card">
                <div className="auth-feature-icon">🎙️</div>
                <div className="auth-feature-text">
                  <h6>Voice Interaction & Speech</h6>
                  <p>Real-time speech-to-text dictation and natural speech read-aloud.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-hero-metrics">
            <div className="auth-metric-item">
              <h4>0.2s</h4>
              <p>Ultra-low Latency</p>
            </div>
            <div className="auth-metric-item">
              <h4>70B</h4>
              <p>Deep Reasoning</p>
            </div>
            <div className="auth-metric-item">
              <h4>100%</h4>
              <p>Encrypted Session</p>
            </div>
          </div>
        </div>

        {/* ================= FORM PANE (RIGHT) ================= */}
        <div className="auth-form-pane">
          
          {/* Header Switcher Tabs */}
          <div className="auth-tabs-header">
            <button className="auth-tab-btn active" type="button">
              <span>🔐</span> Sign In
            </button>
            <button className="auth-tab-btn" type="button" onClick={() => navigate("/signup")}>
              <span>✨</span> Create Account
            </button>
          </div>

          <div className="auth-brand-badge">
            <RelexEmblem />
            <div>
              <div className="auth-brand-title">
                RELEX <span>AI</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Think • Ask • Solve
              </div>
            </div>
          </div>

          {/* Quick Demo Credentials Bar */}
          <div className="auth-quick-fill-bar">
            <span className="auth-quick-fill-label">⚡ Quick Demo:</span>
            <span className="auth-quick-chip" onClick={() => handleQuickFill("user")}>
              👤 Standard User
            </span>
            <span className="auth-quick-chip" onClick={() => handleQuickFill("admin")}>
              👑 Admin User
            </span>
          </div>

          {/* Error Alert Banner */}
          {error && (
            <div className="auth-alert-danger" role="alert">
              <span>⚠️</span>
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            
            {/* Username Input */}
            <div className="auth-field-group">
              <label className="auth-label">Username or Email</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">👤</span>
                <input
                  type="text"
                  className="auth-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="auth-field-group">
              <div className="auth-label">
                <span>Password</span>
              </div>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  style={{ paddingRight: '46px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️‍🗨️" : "👁️"}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-primary-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to RELEX AI</span>
                  <span>→</span>
                </>
              )}
            </button>

          </form>

          {/* Social Divider */}
          <div className="auth-divider-line">
            <span>Or continue with</span>
          </div>

          {/* Social Login Buttons */}
          <div className="auth-social-row">
            <button
              type="button"
              className="auth-social-button google"
              onClick={() => handleSocialLogin("google")}
            >
              <svg className="auth-social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-2.9 0-5.45 1.67-6.72 4.1l3.66 2.84c.87-2.6 3.3-4.56 6.16-4.56z" fill="#EA4335" />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              className="auth-social-button facebook"
              onClick={() => handleSocialLogin("facebook")}
            >
              <svg className="auth-social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: '#64748b' }}>
            New to RELEX AI?{" "}
            <Link to="/signup" style={{ color: '#00d2ff', fontWeight: 700, textDecoration: 'none' }}>
              Create an account
            </Link>
          </div>

        </div>

      </div>

      {/* OAuth Configuration Guide Modal */}
      {showConfigModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white" style={{ background: '#131122', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '20px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold" style={{ color: configModalProvider === "google" ? "#00d2ff" : "#3b82f6" }}>
                  🔧 Set Up {configModalProvider === "google" ? "Google" : "Facebook"} Authentication
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfigModal(false)}></button>
              </div>
              <div className="modal-body py-4">
                <p className="text-light-50 small mb-3">To connect OAuth, please ensure your credentials are set in your environment files:</p>
                
                <h6 className="fw-bold small text-uppercase text-info mb-2">1. Developer Portal Settings</h6>
                <ul className="text-light-50 small ps-3 mb-3">
                  <li>Configure Authorized Redirect URIs to:</li>
                  <code className="d-block bg-black p-2 rounded text-success my-1 font-monospace" style={{ fontSize: '0.8rem' }}>
                    {window.location.origin}/oauth/callback
                  </code>
                </ul>

                <h6 className="fw-bold small text-uppercase text-info mb-2">2. Frontend Setup (frontend/.env)</h6>
                <pre className="bg-black p-2 rounded font-monospace text-warning mb-3" style={{ fontSize: '0.75rem' }}>
                  {configModalProvider === "google" 
                    ? "REACT_APP_GOOGLE_CLIENT_ID=your_real_client_id.apps.googleusercontent.com" 
                    : "REACT_APP_FACEBOOK_CLIENT_ID=your_real_app_id"}
                </pre>

                <h6 className="fw-bold small text-uppercase text-info mb-2">3. Backend Setup (backend/.env)</h6>
                <pre className="bg-black p-2 rounded font-monospace text-warning mb-0" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                  {configModalProvider === "google"
                    ? "GOOGLE_CLIENT_ID=your_real_client_id\nGOOGLE_CLIENT_SECRET=your_real_secret"
                    : "FACEBOOK_CLIENT_ID=your_real_app_id\nFACEBOOK_CLIENT_SECRET=your_real_secret"}
                </pre>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-outline-light w-100" onClick={() => setShowConfigModal(false)}>Close Config Guide</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}