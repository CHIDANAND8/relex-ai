import { useState } from "react";
import { signup } from "../services/api";
import { useNavigate } from "react-router-dom";

const RelexLogo = () => (
  <div className="auth-logo-container">
    <svg width="110" height="110" viewBox="0 0 200 200" style={{ overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#d900ff" />
        </linearGradient>
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComponentTransfer in="blur" result="glow1">
            <feFuncA type="linear" slope="0.8"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="glow1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Glowing outer circular arc */}
      <path d="M 60 170 A 85 85 0 1 1 180 120" fill="none" stroke="url(#neonGrad)" strokeWidth="4" strokeLinecap="round" filter="url(#neonGlow)" />
      
      {/* Circuit lines on the left */}
      <path d="M 55 100 L 78 100" stroke="url(#neonGrad)" strokeWidth="4" strokeLinecap="round" filter="url(#neonGlow)" />
      <circle cx="53" cy="100" r="4.5" fill="#00d2ff" filter="url(#neonGlow)" />
      
      <path d="M 62 120 L 70 120 L 78 135 M 78 135 L 78 140" stroke="url(#neonGrad)" strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round" filter="url(#neonGlow)" />
      <circle cx="60" cy="120" r="4.5" fill="#00d2ff" filter="url(#neonGlow)" />

      <path d="M 60 83 L 70 83 L 78 70 M 78 70 L 78 65" stroke="url(#neonGrad)" strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round" filter="url(#neonGlow)" />
      <circle cx="58" cy="83" r="4.5" fill="#00d2ff" filter="url(#neonGlow)" />

      {/* Stylized R pillars */}
      <path d="M 78 55 L 78 150" stroke="url(#neonGrad)" strokeWidth="20" strokeLinecap="round" filter="url(#neonGlow)" />
      <path d="M 78 66 C 135 66, 135 116, 78 116" stroke="url(#neonGrad)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" filter="url(#neonGlow)" />
      <path d="M 100 114 L 140 152" stroke="url(#neonGrad)" strokeWidth="20" strokeLinecap="round" filter="url(#neonGlow)" />

      {/* Bubble cutout */}
      <path d="M 94 84 C 94 77, 122 77, 122 88 C 122 95, 107 97, 102 102 C 102 98, 94 98, 94 92 Z" fill="#090812" />
      
      <circle cx="104" cy="88" r="2.5" fill="url(#neonGrad)" />
      <circle cx="111" cy="88" r="2.5" fill="url(#neonGrad)" />
      <circle cx="118" cy="88" r="2.5" fill="url(#neonGrad)" />
    </svg>
    <div style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.5px', marginTop: '14px', color: '#ffffff' }}>
      RELEX <span style={{ background: 'linear-gradient(135deg, #00d2ff 0%, #d900ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI</span>
    </div>
    <div className="auth-logo-subtitle">Think • Ask • Solve</div>
    <div className="auth-logo-tagline">Your Intelligent AI Assistant</div>
  </div>
);

export default function Signup() {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configModalProvider, setConfigModalProvider] = useState("");

  const navigate = useNavigate();

  // =============================
  // SOCIAL LOGIN HANDLER
  // =============================
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

  // =============================
  // PASSWORD VALIDATION
  // =============================
  const validatePassword = (pwd) => {
    const pattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,64}$/;
    return pattern.test(pwd);
  };

  // =============================
  // SIGNUP HANDLER
  // =============================
  const handleSignup = async () => {

    if (loading) return;
    setError("");

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!validatePassword(password)) {
      setError(
        "Password must be 8–64 characters and include uppercase, lowercase, number and special character"
      );
      return;
    }

    try {
      setLoading(true);

      await signup({
        username: username.trim(),
        password,
        role
      });

      navigate("/");

    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignup();
  };

  return (
    <div className="auth-page-wrapper p-3">
      <div className="auth-card p-5" style={{ width: '100%', maxWidth: '450px' }}>
        
        <RelexLogo />

        {error && (
          <div className="alert alert-danger py-2 text-center fw-bold small my-3" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="form-label text-light-50 fw-bold small text-uppercase">Username</label>
          <input
            type="text"
            className="form-control form-control-lg fs-6 auth-input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Choose a username"
          />
        </div>

        <div className="mb-4">
          <label className="form-label text-light-50 fw-bold small text-uppercase">Password</label>
          <input
            type="password"
            className="form-control form-control-lg fs-6 mb-2 auth-input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Create a strong password"
          />
          <small className="text-muted d-block lh-sm" style={{ fontSize: '0.75rem' }}>
            Must be 8–64 characters. Requires uppercase, lowercase, number, and special character.
          </small>
        </div>

        <div className="mb-4">
          <label className="form-label text-light-50 fw-bold small text-uppercase">Role</label>
          <select
            className="form-select form-select-lg fs-6 auth-select-field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">Standard User</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <button
          className="btn btn-lg w-100 fw-bold mb-4 auth-submit-btn"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

        <div className="social-divider">Or continue with</div>

        <div className="social-btn-container mb-4">
          <div className="social-btn social-btn-google" onClick={() => handleSocialLogin("google")}>
            <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-2.9 0-5.45 1.67-6.72 4.1l3.66 2.84c.87-2.6 3.3-4.56 6.16-4.56z" fill="#EA4335" />
            </svg>
            Google
          </div>
          <div className="social-btn social-btn-facebook" onClick={() => handleSocialLogin("facebook")}>
            <svg className="social-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
            </svg>
            Facebook
          </div>
        </div>

        <div className="text-center text-light-50">
          Already have an account?{" "}
          <span 
            className="auth-link cursor-pointer" 
            onClick={() => navigate("/")}
          >
            Login
          </span>
        </div>

      </div>

      {showConfigModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white" style={{ background: '#1c1b22', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold" style={{ color: configModalProvider === "google" ? "#00d2ff" : "#3b82f6" }}>
                  🔧 Set Up {configModalProvider === "google" ? "Google" : "Facebook"} Authentication
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfigModal(false)}></button>
              </div>
              <div className="modal-body py-4">
                <p className="text-light-50 small mb-3">To connect real OAuth, please set up credentials in your environment files:</p>
                
                <h6 className="fw-bold small text-uppercase text-info mb-2">1. Developer Portal Settings</h6>
                <ul className="text-light-50 small ps-3 mb-3">
                  <li>Configure Authorized Redirect URIs to:</li>
                  <code className="d-block bg-black p-2 rounded text-success my-1 font-monospace" style={{ fontSize: '0.8rem' }}>
                    {window.location.origin}/oauth/callback
                  </code>
                </ul>

                <h6 className="fw-bold small text-uppercase text-info mb-2">2. Frontend Setup (c:\RELEX AI\frontend\.env)</h6>
                <pre className="bg-black p-2 rounded font-monospace text-warning mb-3" style={{ fontSize: '0.75rem' }}>
                  {configModalProvider === "google" 
                    ? "REACT_APP_GOOGLE_CLIENT_ID=your_real_client_id.apps.googleusercontent.com" 
                    : "REACT_APP_FACEBOOK_CLIENT_ID=your_real_app_id"}
                </pre>

                <h6 className="fw-bold small text-uppercase text-info mb-2">3. Backend Setup (c:\RELEX AI\backend\.env)</h6>
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