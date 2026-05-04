const AUTH_BASE = "https://auth.hackclub.com";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

/**
 * Every URI here must appear exactly in Hack Club → Developer → your app → redirect URIs.
 * HC_REDIRECT_URI is always included; OAUTH_ALLOWED_REDIRECT_URIS adds more (comma-separated).
 * For dev we also add the twin host (localhost ↔ 127.0.0.1) when HC_REDIRECT_URI uses one of them.
 */
export function getAllowedRedirectUris() {
  const primary = process.env.HC_REDIRECT_URI?.trim();
  const set = new Set();

  if (primary) {
    set.add(primary);
  }

  for (const piece of (process.env.OAUTH_ALLOWED_REDIRECT_URIS || "").split(",")) {
    const u = piece.trim();
    if (u) set.add(u);
  }

  if (primary) {
    try {
      const url = new URL(primary);
      const port = url.port ? `:${url.port}` : "";
      if (url.hostname === "localhost") {
        set.add(`http://127.0.0.1${port}${url.pathname}`);
      } else if (url.hostname === "127.0.0.1") {
        set.add(`http://localhost${port}${url.pathname}`);
      }
    } catch {
      // ignore
    }
  }

  return [...set];
}

function parseRequestOrigin(req) {
  const originHeader = req.get("Origin");
  if (originHeader) return originHeader;

  const referer = req.get("Referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Picks redirect_uri for authorize + token exchange. Must match a URI registered at Hack Club exactly.
 */
export function resolveOAuthRedirectUri(req) {
  const allowed = getAllowedRedirectUris();
  if (allowed.length === 0) {
    throw new Error("HC_REDIRECT_URI is not set.");
  }

  const origin = parseRequestOrigin(req);
  if (origin) {
    const candidate = `${origin}/api/auth/hackclub/callback`;
    if (allowed.includes(candidate)) {
      return candidate;
    }
  }

  const fallback = requiredEnv("HC_REDIRECT_URI");
  if (process.env.NODE_ENV !== "production" && origin) {
    console.warn(
      `[auth] No allowlisted redirect for origin ${origin}. Using HC_REDIRECT_URI. Register in Hack Club: ${origin}/api/auth/hackclub/callback`
    );
  }

  return fallback;
}

export function appOriginFromRedirectUri(redirectUri) {
  try {
    return new URL(redirectUri).origin;
  } catch {
    return getAppOrigin();
  }
}

export function getAuthorizeUrl({ state, redirectUri }) {
  const clientId = requiredEnv("HC_CLIENT_ID");
  const scope =
    process.env.HC_SCOPES ||
    "openid profile email name slack_id verification_status";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
  });

  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeAuthorizationCode(code, redirectUri) {
  const clientId = requiredEnv("HC_CLIENT_ID");
  const clientSecret = requiredEnv("HC_CLIENT_SECRET");

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  };

  const response = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Hack Club token response was not JSON.");
  }

  if (!response.ok) {
    const msg = data.error_description || data.error || response.statusText;
    throw new Error(`Token exchange failed: ${msg}`);
  }

  return data;
}

export async function fetchHackClubMe(accessToken) {
  const response = await fetch(`${AUTH_BASE}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Hack Club /me response was not JSON.");
  }

  if (!response.ok) {
    const msg = data.error || data.message || response.statusText;
    throw new Error(`Hack Club /api/v1/me failed: ${msg}`);
  }

  return data;
}

export function getAppOrigin() {
  return process.env.APP_ORIGIN || "http://localhost:5173";
}
