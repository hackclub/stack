import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import "./LoginPage.css";

function normalizeReturnTo(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/main";
  return value;
}

export function LoginPage() {
  const { reload } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const returnTo = useMemo(() => normalizeReturnTo(params.get("returnTo")), [params]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/password/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to log in.");
      await reload();
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <a className="login-card__back" href="/">
          ← Back
        </a>
        <h1>Join Stack</h1>
        <p>Use your email and a password. If this email is new, we’ll create your account.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in / Sign up"}
          </button>
        </form>

        {error ? <p className="login-card__error">{error}</p> : null}
      </section>
    </main>
  );
}
