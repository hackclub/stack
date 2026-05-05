import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  appOriginFromRedirectUri,
  exchangeAuthorizationCode,
  fetchHackClubMe,
  getAppOrigin,
  getAuthorizeUrl,
  resolveOAuthRedirectUri,
} from "./hackclubAuth.js";
import { getUserById, toPublicUser, upsertUserFromHackClub } from "./users.js";

const oauthStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again in a few minutes.",
});

const oauthCallbackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many callback attempts. Please try again shortly.",
});

function isLocalhostRequest(req) {
  const hostHeader = (req.get("X-Forwarded-Host") || req.get("Host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const hostname = hostHeader.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function shouldBypassAuth(req) {
  return process.env.NODE_ENV !== "production" && isLocalhostRequest(req);
}

function getLocalBypassUser() {
  return {
    id: "local-dev",
    hackclubSub: "local-dev",
    email: "local@stack.dev",
    name: "Local Dev",
    slug: "local-dev",
    profileImageUrl: null,
    slackId: null,
    verificationStatus: "unverified",
    role: "admin",
  };
}

function clearBypassSession(req) {
  if (!req.session) return;
  delete req.session.devBypassUser;
  delete req.session.devBypassLoggedOut;
}

function normalizeReturnTo(value) {
  if (typeof value !== "string") return "/main";
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/main";
  }
  return trimmed;
}

function oauthCallbackErrorCode(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Token exchange failed")) return "oauth_token_exchange";
  if (message.includes("/api/v1/me failed")) return "oauth_profile_fetch";
  if (message.includes("DATABASE_URL is not set")) return "oauth_db_config";
  if (message.includes("profile missing stable identifier")) return "oauth_profile_identifier";
  if (message.includes("column") && message.includes("does not exist")) return "oauth_db_schema";
  if (message.includes("is of type") && message.includes("but expression is of type")) return "oauth_db_schema";
  if (message.includes("there is no unique or exclusion constraint matching the ON CONFLICT specification")) {
    return "oauth_db_schema";
  }

  return "oauth_callback";
}

export function createAuthRouter() {
  const router = express.Router();

  router.get("/hackclub/login", oauthStartLimiter, (req, res) => {
    const returnTo = normalizeReturnTo(req.query?.returnTo);

    if (shouldBypassAuth(req)) {
      clearBypassSession(req);
      req.session.devBypassUser = getLocalBypassUser();
      res.redirect(302, `${getAppOrigin()}${returnTo}`);
      return;
    }

    let redirectUri;
    try {
      redirectUri = resolveOAuthRedirectUri(req);
    } catch (error) {
      console.error("[auth] Login redirect_uri setup failed:", error);
      res.redirect(302, `${getAppOrigin()}/?error=oauth_config`);
      return;
    }

    const state = crypto.randomBytes(24).toString("hex");

    if (!req.session) {
      res.redirect(302, `${getAppOrigin()}/?error=session_unavailable`);
      return;
    }

    req.session.oauthState = state;
    req.session.oauthRedirectUri = redirectUri;
    req.session.oauthReturnTo = returnTo;

    const url = getAuthorizeUrl({ state, redirectUri });
    res.redirect(302, url);
  });

  router.get("/hackclub/callback", oauthCallbackLimiter, async (req, res) => {
    const storedRedirectUri = req.session?.oauthRedirectUri;
    const sessionState = req.session?.oauthState;
    const returnTo = normalizeReturnTo(req.session?.oauthReturnTo);
    const redirectUri =
      typeof storedRedirectUri === "string" && storedRedirectUri
        ? storedRedirectUri
        : process.env.HC_REDIRECT_URI?.trim() || null;

    if (req.session) {
      delete req.session.oauthState;
      delete req.session.oauthRedirectUri;
      delete req.session.oauthReturnTo;
    }

    const appOrigin = redirectUri ? appOriginFromRedirectUri(redirectUri) : getAppOrigin();

    try {
      const code = req.query.code;
      const state = req.query.state;

      if (typeof code !== "string" || !code) {
        res.redirect(302, `${appOrigin}/?error=oauth_missing_code`);
        return;
      }

      if (typeof state !== "string" || !sessionState || state !== sessionState) {
        res.redirect(302, `${appOrigin}/?error=oauth_state`);
        return;
      }

      if (!redirectUri) {
        res.redirect(302, `${getAppOrigin()}/?error=oauth_missing_redirect`);
        return;
      }

      const token = await exchangeAuthorizationCode(code, redirectUri);
      const accessToken = token.access_token;
      if (!accessToken) {
        res.redirect(302, `${appOrigin}/?error=oauth_no_access_token`);
        return;
      }

      const profile = await fetchHackClubMe(accessToken);
      const user = await upsertUserFromHackClub({ profile, token });

      req.session.userId = user.id;
      req.session.hackclubSub = user.hackclub_sub;

      res.redirect(302, `${appOrigin}${returnTo}`);
    } catch (error) {
      console.error("[auth] Hack Club callback failed:", error);
      const errorCode = oauthCallbackErrorCode(error);
      res.redirect(302, `${getAppOrigin()}/?error=${errorCode}`);
    }
  });

  router.get("/me", async (req, res) => {
    try {
      if (shouldBypassAuth(req)) {
        if (req.session?.devBypassLoggedOut) {
          res.json({ user: null });
          return;
        }

        const bypassUser = req.session?.devBypassUser || getLocalBypassUser();
        if (req.session) {
          req.session.devBypassUser = bypassUser;
        }
        res.json({ user: bypassUser });
        return;
      }

      const userId = req.session?.userId;
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
    if (shouldBypassAuth(req) && req.session) {
      req.session.devBypassLoggedOut = true;
      delete req.session.devBypassUser;
      delete req.session.userId;
      delete req.session.hackclubSub;
      res.json({ ok: true });
      return;
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("[auth] logout failed:", err);
        res.status(500).json({ ok: false });
        return;
      }
      res.clearCookie("stack.sid", { path: "/" });
      res.json({ ok: true });
    });
  });

  return router;
}
