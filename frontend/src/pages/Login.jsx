import { useState } from "react";
import { login } from "../services/api";
import { useNavigate } from "react-router-dom";
import PremiumBackground from "../components/PremiumBackground";
import "../styles/Auth.css";

export default function Login() {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // =============================
  // LOGIN HANDLER
  // =============================
  const handleLogin = async () => {

    if (loading) return;

    setError("");

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    try {
      setLoading(true);

      const data = await login({
        username: username.trim(),
        password
      });

      // Save session
      localStorage.setItem("user", JSON.stringify(data));

      // Role-based navigation
      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/chat");
      }

    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Submit on Enter
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
  <div className="auth-container">
  <PremiumBackground />

  <div className="auth-card">

        <div className="auth-title">RELEX AI</div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <div className="input-group">
          <input
            type="text"
            required
            placeholder=" "
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <label>Username</label>
        </div>

        <div className="input-group">
          <input
            type="password"
            required
            placeholder=" "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <label>Password</label>
        </div>

        <button
          className="auth-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Authenticating..." : "Login"}
        </button>

        <div className="auth-link">
          Don’t have an account?{" "}
          <span onClick={() => navigate("/signup")}>
            Create Account
          </span>
        </div>

      </div>
    </div>
  );
}