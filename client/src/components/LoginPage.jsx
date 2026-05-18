import { useEffect, useMemo } from "react";
import "./LoginPage.css";

const ERROR_MESSAGES = {
  oauth_config: "Login is not configured correctly. Please contact @Scooter.",
  oauth_missing_code: "Hack Club did not return an authorization code.",
  oauth_state: "Login session expired. Please try again.",
  oauth_missing_redirect: "OAuth redirect URI was missing.",
  oauth_no_access_token: "Hack Club did not return an access token.",
  oauth_callback: "Hack Club login failed. Please try again.",
};

function normalizeReturnTo(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/main";
  return value;
}

export function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = useMemo(() => normalizeReturnTo(params.get("returnTo")), [params]);
  const errorCode = params.get("error");
  const errorMessage = ERROR_MESSAGES[errorCode] || (errorCode ? "Login failed. Please try again." : "");

  useEffect(() => {
    if (errorCode) return;

    const loginUrl = `/api/auth/hackclub/login?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.replace(loginUrl);
  }, [errorCode, returnTo]);

  return (
    <main className="login-page">
      <section className="login-card">
        <a className="login-card__back" href="/">
          ← Back
        </a>
        <h1>Join Stack</h1>
        {errorMessage ? (
          <>
            <p className="login-card__error">{errorMessage}</p>
            <p>
              <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Try Hack Club login again</a>
            </p>
          </>
        ) : (
          <p>Redirecting to Hack Club Auth…</p>
        )}
      </section>
    </main>
  );
}
