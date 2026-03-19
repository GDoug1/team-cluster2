import "../styles/AuthPages.css";
import "../styles/login.css";
import { useState } from "react";
import { apiFetch } from "../api/api";
import AuthLayout from "../components/AuthLayout";

import bg from "../assets/login_bg.svg";
import logo from "../assets/ireply.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await apiFetch("auth/login.php", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      const normalizedRole = String(data.role || "").toLowerCase();

      if (data.fullname) {
        localStorage.setItem(
          "teamClusterUser",
          JSON.stringify({
            fullname: data.fullname,
            role: data.role
          })
        );
      }

      const redirectPath =
        data.redirect ||
        (normalizedRole.includes("super admin")
          ? "/super-admin"
          : normalizedRole.includes("admin")
          ? "/admin"
          : normalizedRole.includes("coach")
          ? "/coach"
          : "/employee");

      window.location.href = redirectPath;
    } catch (err) {
      setError(err.error || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout showPanel={false}  className="auth-login"  title="" description="" highlights={[]}>
        <div
          className="login-page-container"
          style={{ backgroundImage: `url(${bg})` }}
        >
        <form className="login-page-card" onSubmit={handleSubmit}>
          
          <div className="login-page-logo">
            <img src={logo} alt="Logo" />
          </div>

          {error && <p className="login-page-error">{error}</p>}

          <div className="login-page-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-page-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="login-page-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "LOG IN"}
          </button>

        </form>
      </div>
    </AuthLayout>
  );
}