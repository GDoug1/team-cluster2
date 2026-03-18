import "../styles/AuthPages.css";
import { useEffect, useState } from "react";
import { apiFetch } from "../api/api";
import AuthLayout from "../components/AuthLayout";
import { registerHighlights } from "../utils/authContent";

export default function Register() {
  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
    role_id: ""
  });

  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRoles() {
      try {
        const response = await apiFetch("auth/roles.php");
        if (!isMounted) {
          return;
        }
        setRoles(Array.isArray(response.roles) ? response.roles : []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err.error || "Unable to load roles");
      }
    }

    loadRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiFetch("auth/register.php", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          role_id: Number(form.role_id)
        })
      });

      window.location.href = "/login";
    } catch (err) {
      setError(err.error || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      
      highlights={registerHighlights}
    >
      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <h2 className="auth-heading">Register</h2>
          <p className="auth-subtitle">Create an account to access the cluster tools.</p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <label className="auth-field">
          Full name
          <input
            className="auth-input"
            name="fullname"
            placeholder="Jane Cooper"
            onChange={handleChange}
            required
          />
        </label>

        <label className="auth-field">
          Work email
          <input
            className="auth-input"
            type="email"
            name="email"
            placeholder="name@company.com"
            onChange={handleChange}
            required
          />
        </label>

        <label className="auth-field">
          Password
          <input
            className="auth-input"
            type="password"
            name="password"
            placeholder="Create a secure password"
            onChange={handleChange}
            required
          />
        </label>

        <label className="auth-field">
          Select role
          <select
            className="auth-select"
            name="role_id"
            value={form.role_id}
            onChange={handleChange}
            required
          >
            <option value="" disabled>Select Role</option>
            {roles.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn primary auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>

        <p className="auth-footer">
          Already have access? <a href="/login">Sign in</a>
        </p>
      </form>
    </AuthLayout>
  );
}
