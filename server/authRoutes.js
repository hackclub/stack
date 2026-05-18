import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  getUserById,
  toPublicUser,
  upsertUserFromHackClub,
} from "./users.js";
import { upsertAuthUserToAirtable } from "./airtable.js";
import {
  appOriginFromRedirectUri,
  exchangeAuthorizationCode,
  fetchHackClubMe,
  getAppOrigin,
  getAuthorizeUrl,
  resolveOAuthRedirectUri,
} from "./hackclubAuth.js";

const LOCAL_DEV_AUTH_COOKIE = "stack.local_user";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const oauthLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again in a few minutes.",
});

function normalizeReturnTo(value) {
  if (typeof value !== "string") return "/main";
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/main";
  }
  return trimmed;
}

function isLocalhostRequest(req) {
  const hostHeader = (req.get("X-Forwarded-Host") || req.get("Host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const hostname = hostHeader.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function shouldUseLocalDevCookie(req) {
  return process.env.NODE_ENV !== "production" && isLocalhostRequest(req);
}

function localDevCookieSecret() {
  return process.env.DEV_AUTH_COOKIE_SECRET || process.env.SESSION_SECRET || "dev-local-auth-cookie-secret";
}

function signLocalUserId(userId) {
  const payload = String(userId);
  const signature = crypto.createHmac("sha256", localDevCookieSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyLocalUserCookie(value) {
  const [payload, signature] = String(value || "").split(".");
  if (!payload || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", localDevCookieSecret()).update(payload).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  return payload;
}

function setLocalDevAuthCookie(req, res, userId) {
  if (!shouldUseLocalDevCookie(req)) return;

  res.cookie(LOCAL_DEV_AUTH_COOKIE, signLocalUserId(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function createAuthRouter() {
  const router = express.Router();

  router.get("/hackclub/login", oauthLoginLimiter, (req, res) => {
    const returnTo = normalizeReturnTo(req.query?.returnTo);
    try {
      const redirectUri = resolveOAuthRedirectUri(req);
      const state = crypto.randomBytes(24).toString("hex");
      req.session.oauth = {
        state,
        returnTo,
        redirectUri,
        createdAt: Date.now(),
      };
      res.redirect(302, getAuthorizeUrl({ state, redirectUri }));
    } catch (error) {
      console.error("[auth] failed to start Hack Club auth:", error);
      res.redirect(302, `${getAppOrigin()}/login?error=${encodeURIComponent("Failed to start login.")}`);
    }
  });

  router.get("/hackclub/callback", oauthLoginLimiter, async (req, res) => {
    const stateFromQuery = String(req.query?.state || "");
    const code = String(req.query?.code || "");
    const authError = req.query?.error ? String(req.query.error) : "";
    const oauthState = req.session?.oauth;
    delete req.session.oauth;
    let redirectUri = oauthState?.redirectUri || "";
    if (!redirectUri) {
      try {
        redirectUri = resolveOAuthRedirectUri(req);
      } catch {
        redirectUri = "";
      }
    }
    const appOrigin = appOriginFromRedirectUri(redirectUri);
    const returnTo = normalizeReturnTo(oauthState?.returnTo);

    if (authError) {
      res.redirect(
        302,
        `${appOrigin}/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent(authError)}`
      );
      return;
    }

    if (!oauthState?.state || oauthState.state !== stateFromQuery || !code) {
      res.redirect(
        302,
        `${appOrigin}/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent("Invalid login state.")}`
      );
      return;
    }

    if (!oauthState.createdAt || Date.now() - oauthState.createdAt > OAUTH_STATE_TTL_MS) {
      res.redirect(
        302,
        `${appOrigin}/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent("Login attempt expired.")}`
      );
      return;
    }

    try {
      if (!redirectUri) {
        throw new Error("OAuth redirect URI is not configured.");
      }
      const token = await exchangeAuthorizationCode(code, redirectUri);
      const profile = await fetchHackClubMe(token.access_token);
      const user = await upsertUserFromHackClub({ profile, token });

      req.session.userId = user.id;
      req.session.hackclubSub = user.hackclub_sub;
      setLocalDevAuthCookie(req, res, user.id);

      try {
        await upsertAuthUserToAirtable(user, profile);
      } catch (airtableError) {
        console.error("[auth] failed to sync _users Airtable record:", airtableError);
      }

      res.redirect(302, `${appOrigin}${returnTo}`);
    } catch (error) {
      console.error("[auth] Hack Club callback failed:", error);
      res.redirect(
        302,
        `${appOrigin}/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent("Failed to log in.")}`
      );
    }
  });

  router.get("/me", async (req, res) => {
    try {
      let userId = req.session?.userId;
      if (!userId && shouldUseLocalDevCookie(req)) {
        const restoredUserId = verifyLocalUserCookie(req.cookies?.[LOCAL_DEV_AUTH_COOKIE]);
        if (restoredUserId) {
          userId = restoredUserId;
          req.session.userId = restoredUserId;
        }
      }

      if (!userId) {
        res.json({ user: null });
        return;
      }

      const row = await getUserById(userId);
      res.json({ user: toPublicUser(row) });
    } catch (error) {
      console.error("[auth] /me failed:", error);
      res.status(500).json({ error: "Failed to load session user." });
    }
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[auth] logout failed:", err);
        res.status(500).json({ ok: false });
        return;
      }
      res.clearCookie("stack.sid", { path: "/" });
      res.clearCookie(LOCAL_DEV_AUTH_COOKIE, { path: "/" });
      res.json({ ok: true });
    });
  });

  return router;
}
