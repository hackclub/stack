import crypto from "crypto";

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_ATTEMPTS = 10;
const JOURNALING_SESSION_MS = 8 * 60 * 60 * 1000;

const authAttempts = new Map();

function digestSecret(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

export function timingSafeSecretMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !expected) {
    return false;
  }

  const providedDigest = digestSecret(provided);
  const expectedDigest = digestSecret(expected);
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function pruneExpiredAttempts(now) {
  for (const [ip, entry] of authAttempts) {
    if (now > entry.resetAt) {
      authAttempts.delete(ip);
    }
  }
}

export function consumeJournalingAuthAttempt(req) {
  const ip = clientIp(req);
  const now = Date.now();
  pruneExpiredAttempts(now);

  let entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + AUTH_WINDOW_MS };
    authAttempts.set(ip, entry);
  }

  entry.count += 1;
  if (entry.count > MAX_AUTH_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function clearJournalingAuthAttempts(req) {
  authAttempts.delete(clientIp(req));
}

export function isJournalingSessionValid(session) {
  if (!session?.journalingRecordsOk) return false;
  const authenticatedAt = Number(session.journalingRecordsAt);
  if (!Number.isFinite(authenticatedAt)) return false;
  return Date.now() - authenticatedAt <= JOURNALING_SESSION_MS;
}

export function markJournalingSession(session) {
  session.journalingRecordsOk = true;
  session.journalingRecordsAt = Date.now();
}

export function clearJournalingSession(session) {
  delete session.journalingRecordsOk;
  delete session.journalingRecordsAt;
}
