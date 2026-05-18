import { useMemo } from "react";
import "./LoginPage.css";

function normalizeReturnTo(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/main";
  return value;
}

export function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = useMemo(() => normalizeReturnTo(params.get("returnTo")), [params]);
  const error = params.get("error");
  const loginHref = `/api/auth/hackclub/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="login-page">
      <section className="login-card">
        <a className="login-card__back" href="/">
          ← Back
        </a>
        <h1>Join Stack</h1>
        <p>Sign in with your Hack Club account to continue.</p>
        <a className="login-card__oauth" href={loginHref}>
          Continue with Hack Club Auth
        </a>
        {error ? <p className="login-card__error">{error}</p> : null}
      </section>
    </main>
  );
}
