import crypto from "crypto";
import express from "express";
import {
  appOriginFromRedirectUri,
  describeHackClubProfile,
  exchangeAuthorizationCode,
  fetchHackClubMe,
  getAppOrigin,
  getAuthorizeUrl,
  resolveOAuthRedirectUri,
} from "./hackclubAuth.js";
import { syncPostgresUserToAirtable, syncUserToAirtableUsers } from "./airtableUsers.js";
import {
  connectHackatimeForUser,
  isHackatimeConnected,
} from "./hackatimeService.js";
import {
  exchangeHackatimeAuthorizationCode,
  getHackatimeAuthorizeUrl,
  isHackatimeOAuthConfigured,
  resolveHackatimeRedirectUri,
} from "./hackatimeAuth.js";
import {
  buildSessionProfileSnapshot,
  describeProfileIdentifier,
  getUserById,
  hackclubSubFromProfile,
  isDatabaseConnectionError,
  toPublicUser,
  toPublicUserFromSessionSnapshot,
  upsertUserFromHackClub,
} from "./users.js";

const LOCAL_DEV_AUTH_COOKIE = "stack.local_user";

function normalizeReturnTo(value) {
  if (typeof value !== "string") return "/main";
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/main";
  }
  return trimmed;
}

function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
    path: "/",
  };
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
  if (!shouldUseLocalDevCookie(req) || !userId) return;

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

  router.get("/hackclub/login", (req, res) => {
    let redirectUri;
    try {
      redirectUri = resolveOAuthRedirectUri(req);
    } catch (error) {
      console.error("[auth] Login redirect_uri setup failed:", error);
      res.redirect(302, `${getAppOrigin()}/login?error=oauth_config`);
      return;
    }

    const returnTo = normalizeReturnTo(req.query?.returnTo);
    const state = crypto.randomBytes(24).toString("hex");

    res.cookie("hc_oauth_state", state, oauthCookieOptions());
    res.cookie("hc_oauth_redirect_uri", redirectUri, oauthCookieOptions());
    res.cookie("hc_oauth_return_to", returnTo, oauthCookieOptions());

    const url = getAuthorizeUrl({ state, redirectUri });
    res.redirect(302, url);
  });

  router.get("/hackclub/callback", async (req, res) => {
    const storedRedirectUri = req.cookies?.hc_oauth_redirect_uri;
    const cookieState = req.cookies?.hc_oauth_state;
    const returnTo = normalizeReturnTo(req.cookies?.hc_oauth_return_to);
    const redirectUri =
      typeof storedRedirectUri === "string" && storedRedirectUri
        ? storedRedirectUri
        : process.env.HC_REDIRECT_URI?.trim() || null;

    res.clearCookie("hc_oauth_state", { path: "/" });
    res.clearCookie("hc_oauth_redirect_uri", { path: "/" });
    res.clearCookie("hc_oauth_return_to", { path: "/" });

    const appOrigin = redirectUri ? appOriginFromRedirectUri(redirectUri) : getAppOrigin();

    try {
      const code = req.query.code;
      const state = req.query.state;

      if (typeof code !== "string" || !code) {
        res.redirect(302, `${appOrigin}/login?error=oauth_missing_code`);
        return;
      }

      if (typeof state !== "string" || !cookieState || state !== cookieState) {
        res.redirect(302, `${appOrigin}/login?error=oauth_state`);
        return;
      }

      if (!redirectUri) {
        res.redirect(302, `${appOrigin}/login?error=oauth_missing_redirect`);
        return;
      }

      const token = await exchangeAuthorizationCode(code, redirectUri);
      const accessToken = token.access_token;
      if (!accessToken) {
        res.redirect(302, `${appOrigin}/login?error=oauth_no_access_token`);
        return;
      }

      const profile = await fetchHackClubMe(accessToken);
      console.log("[auth] HCA /me profile shape:", describeHackClubProfile(profile));

      let user = null;
      try {
        user = await upsertUserFromHackClub({ profile, token });
      } catch (dbError) {
        const dbUnavailable = isDatabaseConnectionError(dbError);
        console.error("[auth] Postgres user upsert failed:", {
          message: dbError instanceof Error ? dbError.message : String(dbError),
          code: dbError?.code,
          dbUnavailable,
          profile: describeProfileIdentifier(profile),
        });
        if (!dbUnavailable) {
          throw dbError;
        }
      }

      try {
        if (user?.id) {
          const userRow = await getUserById(user.id);
          const airtableResult = await syncPostgresUserToAirtable(userRow);
          console.log("[auth] Airtable _users sync:", airtableResult);
        } else {
          const airtableResult = await syncUserToAirtableUsers(profile);
          console.log("[auth] Airtable _users sync:", airtableResult);
        }
      } catch (syncError) {
        console.error("[auth] Airtable _users sync failed:", {
          message: syncError instanceof Error ? syncError.message : String(syncError),
          profile: describeProfileIdentifier(profile),
        });
      }

      const hackclubSub = hackclubSubFromProfile(profile);
      req.session.hackclubSub = hackclubSub;
      req.session.profileSnapshot = buildSessionProfileSnapshot(profile, { userRow: user });

      if (user?.id) {
        req.session.userId = user.id;
        setLocalDevAuthCookie(req, res, user.id);

        const userRow = await getUserById(user.id);
        if (isHackatimeOAuthConfigured() && userRow && !isHackatimeConnected(userRow)) {
          const htState = crypto.randomBytes(24).toString("hex");
          const htRedirectUri = resolveHackatimeRedirectUri(req);
          res.cookie("ht_oauth_state", htState, oauthCookieOptions());
          res.cookie("ht_oauth_redirect_uri", htRedirectUri, oauthCookieOptions());
          res.cookie("ht_oauth_return_to", returnTo, oauthCookieOptions());
          res.redirect(302, getHackatimeAuthorizeUrl({ state: htState, redirectUri: htRedirectUri }));
          return;
        }
      } else {
        delete req.session.userId;
      }

      res.redirect(302, `${appOrigin}${returnTo}`);
    } catch (error) {
      console.error("[auth] Hack Club callback failed:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        queryError: req.query?.error,
        queryErrorDescription: req.query?.error_description,
      });
      res.redirect(302, `${appOrigin}/login?error=oauth_callback`);
    }
  });

  router.get("/hackatime/login", (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
      res.redirect(302, `${getAppOrigin()}/login?error=auth_required`);
      return;
    }

    if (!isHackatimeOAuthConfigured()) {
      const returnTo = normalizeReturnTo(req.query?.returnTo);
      res.redirect(302, `${getAppOrigin()}${returnTo}`);
      return;
    }

    try {
      const returnTo = normalizeReturnTo(req.query?.returnTo);
      const htRedirectUri = resolveHackatimeRedirectUri(req);
      const htState = crypto.randomBytes(24).toString("hex");
      res.cookie("ht_oauth_state", htState, oauthCookieOptions());
      res.cookie("ht_oauth_redirect_uri", htRedirectUri, oauthCookieOptions());
      res.cookie("ht_oauth_return_to", returnTo, oauthCookieOptions());
      res.redirect(302, getHackatimeAuthorizeUrl({ state: htState, redirectUri: htRedirectUri }));
    } catch (error) {
      console.error("[auth] Hackatime login setup failed:", error);
      res.redirect(302, `${getAppOrigin()}/main?error=hackatime_config`);
    }
  });

  router.get("/hackatime/callback", async (req, res) => {
    const cookieState = req.cookies?.ht_oauth_state;
    const returnTo = normalizeReturnTo(req.cookies?.ht_oauth_return_to);
    const storedRedirectUri = req.cookies?.ht_oauth_redirect_uri;
    const redirectUri =
      typeof storedRedirectUri === "string" && storedRedirectUri
        ? storedRedirectUri
        : resolveHackatimeRedirectUri(req);

    res.clearCookie("ht_oauth_state", { path: "/" });
    res.clearCookie("ht_oauth_return_to", { path: "/" });
    res.clearCookie("ht_oauth_redirect_uri", { path: "/" });

    const appOrigin = process.env.APP_ORIGIN?.trim() || getAppOrigin();

    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.redirect(302, `${appOrigin}/login?error=auth_required`);
        return;
      }

      if (req.query.error) {
        console.warn("[auth] Hackatime OAuth denied:", req.query.error);
        res.redirect(302, `${appOrigin}${returnTo}?hackatime=denied`);
        return;
      }

      const code = req.query.code;
      const state = req.query.state;
      if (typeof code !== "string" || !code) {
        res.redirect(302, `${appOrigin}${returnTo}?error=hackatime_missing_code`);
        return;
      }

      if (typeof state !== "string" || !cookieState || state !== cookieState) {
        res.redirect(302, `${appOrigin}${returnTo}?error=hackatime_state`);
        return;
      }

      const token = await exchangeHackatimeAuthorizationCode(code, redirectUri);
      await connectHackatimeForUser(userId, token);

      res.redirect(302, `${appOrigin}${returnTo}?hackatime=connected`);
    } catch (error) {
      console.error("[auth] Hackatime callback failed:", {
        message: error instanceof Error ? error.message : String(error),
      });
      res.redirect(302, `${appOrigin}${returnTo}?error=hackatime_callback`);
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

      if (userId) {
        try {
          const row = await getUserById(userId);
          if (row) {
            res.json({ user: toPublicUser(row) });
            return;
          }
        } catch (dbError) {
          if (!isDatabaseConnectionError(dbError)) {
            throw dbError;
          }
          console.warn("[auth] /me Postgres unavailable, using session snapshot.");
        }
      }

      const snapshotUser = toPublicUserFromSessionSnapshot(req.session?.profileSnapshot);
      if (snapshotUser) {
        res.json({ user: snapshotUser });
        return;
      }

      res.json({ user: null });
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
