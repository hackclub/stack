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

export function createAuthRouter() {
  const router = express.Router();

  router.get("/hackclub/login", oauthStartLimiter, (req, res) => {
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

    const url = getAuthorizeUrl({ state, redirectUri });
    res.redirect(302, url);
  });

  router.get("/hackclub/callback", oauthCallbackLimiter, async (req, res) => {
    const storedRedirectUri = req.session?.oauthRedirectUri;
    const sessionState = req.session?.oauthState;
    const redirectUri =
      typeof storedRedirectUri === "string" && storedRedirectUri
        ? storedRedirectUri
        : process.env.HC_REDIRECT_URI?.trim() || null;

    if (req.session) {
      delete req.session.oauthState;
      delete req.session.oauthRedirectUri;
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

      res.redirect(302, `${appOrigin}/main`);
    } catch (error) {
      console.error("[auth] Hack Club callback failed:", error);
      res.redirect(302, `${getAppOrigin()}/?error=oauth_callback`);
    }
  });

  router.get("/me", async (req, res) => {
    try {
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
