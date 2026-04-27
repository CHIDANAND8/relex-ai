import { useState } from "react";
import { signup } from "../services/api";
import { useNavigate } from "react-router-dom";
import PremiumBackground from "../components/PremiumBackground";
import "../styles/Auth.css";

export default function Signup() {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

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
    <div className="auth-container">
      <PremiumBackground/>

      <div className="auth-card">

        <div className="auth-title">Create Account</div>

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

        <small className="password-hint">
          8–64 characters, uppercase, lowercase, number & special character
        </small>

        <div className="input-group">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <label>Role</label>
        </div>

        <button
          className="auth-btn"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Signup"}
        </button>

        <div className="auth-link">
          Already have an account?{" "}
          <span onClick={() => navigate("/")}>
            Login
          </span>
        </div>

      </div>
    </div>
  );
}