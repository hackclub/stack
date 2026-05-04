import crypto from "crypto";
import express from "express";
import {
  appOriginFromRedirectUri,
  exchangeAuthorizationCode,
  fetchHackClubMe,
  getAppOrigin,
  getAuthorizeUrl,
  resolveOAuthRedirectUri,
} from "./hackclubAuth.js";
import { getUserById, toPublicUser, upsertUserFromHackClub } from "./users.js";

function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
    path: "/",
  };
}

export function createAuthRouter() {
  const router = express.Router();

  router.get("/hackclub/login", (req, res) => {
    let redirectUri;
    try {
      redirectUri = resolveOAuthRedirectUri(req);
    } catch (error) {
      console.error("[auth] Login redirect_uri setup failed:", error);
      res.redirect(302, `${getAppOrigin()}/?error=oauth_config`);
      return;
    }

    const state = crypto.randomBytes(24).toString("hex");

    res.cookie("hc_oauth_state", state, oauthCookieOptions());
    res.cookie("hc_oauth_redirect_uri", redirectUri, oauthCookieOptions());

    const url = getAuthorizeUrl({ state, redirectUri });
    res.redirect(302, url);
  });

  router.get("/hackclub/callback", async (req, res) => {
    const storedRedirectUri = req.cookies?.hc_oauth_redirect_uri;
    const cookieState = req.cookies?.hc_oauth_state;
    const redirectUri =
      typeof storedRedirectUri === "string" && storedRedirectUri
        ? storedRedirectUri
        : process.env.HC_REDIRECT_URI?.trim() || null;

    res.clearCookie("hc_oauth_state", { path: "/" });
    res.clearCookie("hc_oauth_redirect_uri", { path: "/" });

    const appOrigin = redirectUri ? appOriginFromRedirectUri(redirectUri) : getAppOrigin();

    try {
      const code = req.query.code;
      const state = req.query.state;

      if (typeof code !== "string" || !code) {
        res.redirect(302, `${appOrigin}/?error=oauth_missing_code`);
        return;
      }

      if (typeof state !== "string" || !cookieState || state !== cookieState) {
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
