import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  createUserFromEmailPassword,
  getUserByEmail,
  getUserById,
  setPasswordForExistingUser,
  toPublicUser,
  updateUserRoleFromEmail,
} from "./users.js";

const passwordLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again in a few minutes.",
});
const LOCAL_DEV_AUTH_COOKIE = "stack.local_user";

function normalizeReturnTo(value) {
  if (typeof value !== "string") return "/main";
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/main";
  }
  return trimmed;
}

function getAppOrigin() {
  return process.env.APP_ORIGIN || "http://localhost:5173";
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

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = String(storedHash || "").split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const submittedHash = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, "hex");
  return storedBuffer.length === submittedHash.length && crypto.timingSafeEqual(storedBuffer, submittedHash);
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

  router.get("/hackclub/login", (req, res) => {
    const returnTo = normalizeReturnTo(req.query?.returnTo);
    res.redirect(302, `${getAppOrigin()}/login?returnTo=${encodeURIComponent(returnTo)}&auth=password`);
  });

  router.get("/hackclub/callback", (req, res) => {
    res.redirect(302, `${getAppOrigin()}/login?auth=password`);
  });

  router.post("/password/login", passwordLoginLimiter, async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");

      if (!isValidEmail(email)) {
        res.status(422).json({ error: "Enter a valid email address." });
        return;
      }

      if (password.length < 6) {
        res.status(422).json({ error: "Password must be at least 6 characters." });
        return;
      }

      const existingUser = await getUserByEmail(email);
      let user;

      if (existingUser?.password_hash) {
        if (!verifyPassword(password, existingUser.password_hash)) {
          res.status(401).json({ error: "Wrong email or password." });
          return;
        }
        user = await updateUserRoleFromEmail(existingUser.id, email);
      } else if (existingUser) {
        user = await setPasswordForExistingUser(existingUser.id, email, hashPassword(password));
      } else {
        user = await createUserFromEmailPassword(email, hashPassword(password));
      }

      req.session.userId = user.id;
      delete req.session.hackclubSub;
      setLocalDevAuthCookie(req, res, user.id);

      res.json({ user: toPublicUser(user) });
    } catch (error) {
      console.error("[auth] password login failed:", error);
      res.status(500).json({ error: "Failed to log in." });
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
