const AUTH_BASE = "https://auth.hackclub.com";
const OAUTH_CALLBACK_PATH = "/api/auth/hackclub/callback";

function buildCallbackUri(origin) {
  const trimmedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${trimmedOrigin}${OAUTH_CALLBACK_PATH}`;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}


export function getAllowedRedirectUris() {
  const primary = process.env.HC_REDIRECT_URI?.trim();
  const set = new Set();

  if (primary) {
    set.add(primary);
  }

  const appOrigin = process.env.APP_ORIGIN?.trim();
  if (appOrigin) {
    set.add(buildCallbackUri(appOrigin));
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
        set.add(`${url.protocol}//127.0.0.1${port}${url.pathname}`);
      } else if (url.hostname === "127.0.0.1") {
        set.add(`${url.protocol}//localhost${port}${url.pathname}`);
      }
    } catch {
      // ignore
    }
  }

  return [...set];
}

function parseRequestOrigin(req) {
  const originHeader = req.get("Origin");
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      return parsed.origin;
    } catch {
    }
  }

  const referer = req.get("Referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  const forwardedHost = req.get("X-Forwarded-Host");
  const host = (forwardedHost || req.get("Host") || "").split(",")[0].trim();
  const forwardedProto = req.get("X-Forwarded-Proto");
  const protocol =
    (forwardedProto || req.protocol || "").split(",")[0].trim() ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host && protocol) {
    return `${protocol}://${host}`;
  }

  return null;
}


export function resolveOAuthRedirectUri(req) {
  const allowed = getAllowedRedirectUris();
  const origin = parseRequestOrigin(req);
  if (allowed.length === 0) {
    if (origin) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[auth] No explicit OAuth redirect URI configured; using request origin callback ${buildCallbackUri(origin)}`
        );
      }
      return buildCallbackUri(origin);
    }
    throw new Error("HC_REDIRECT_URI (or APP_ORIGIN) is not set.");
  }

  if (origin) {
    const candidate = buildCallbackUri(origin);
    if (allowed.includes(candidate)) {
      return candidate;
    }
  }

  const fallback = process.env.HC_REDIRECT_URI?.trim() || allowed[0];
  if (process.env.NODE_ENV !== "production" && origin) {
    console.warn(
      `[auth] No allowlisted redirect for origin ${origin}. Using configured fallback ${fallback}. Register in Hack Club: ${origin}/api/auth/hackclub/callback`
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
  const configuredScopes = (process.env.HC_SCOPES || "").trim();
  const scopeList = configuredScopes
    ? configuredScopes.split(/\s+/).filter(Boolean)
    : ["basic_info"];
  const scope = [...new Set(scopeList)].join(" ");

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
