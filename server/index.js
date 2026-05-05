import "./env.js";
import cookieParser from "cookie-parser";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { createAuthRouter } from "./authRoutes.js";
import { getAirtableSyncStatus, startAirtableAutoSync, syncDatabaseToAirtable } from "./airtable.js";
import { checkDatabaseConnection, getTestRows } from "./db.js";
import { ensureUsersTable } from "./users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  app.set("trust proxy", 1);
}
const LOCK_USERNAME = process.env.SITE_LOCK_USERNAME;
const LOCK_PASSWORD = process.env.SITE_LOCK_PASSWORD;
const siteLockEnabled = Boolean(LOCK_USERNAME && LOCK_PASSWORD);
const AIRTABLE_SYNC_SECRET = process.env.AIRTABLE_SYNC_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (isProd && !SESSION_SECRET) {
  console.warn("[session] SESSION_SECRET is not set; using insecure default. Set SESSION_SECRET in production.");
}

app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    name: "stack.sid",
    secret: SESSION_SECRET || "dev-insecure-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use("/api/auth", createAuthRouter());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "stack-api" });
});

app.get("/api/db/health", async (req, res) => {
  try {
    const health = await checkDatabaseConnection();
    res.status(health.ok ? 200 : 503).json(health);
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({
      ok: false,
      configured: true,
      message: "Database health check failed.",
    });
  }
});

if (siteLockEnabled) {
  app.use((req, res, next) => {
    if (
      req.path === "/api/health" ||
      req.path === "/api/db/health" ||
      req.path.startsWith("/api/auth")
    ) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Basic ")) {
      res.set("WWW-Authenticate", 'Basic realm="Stack (private)", charset="UTF-8"');
      res.status(401).send("Authentication required.");
      return;
    }

    let decoded;
    try {
      decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    } catch {
      res.set("WWW-Authenticate", 'Basic realm="Stack (private)", charset="UTF-8"');
      res.status(401).send("Invalid authentication header.");
      return;
    }

    const separatorIndex = decoded.indexOf(":");
    const username = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

    if (username !== LOCK_USERNAME || password !== LOCK_PASSWORD) {
      res.set("WWW-Authenticate", 'Basic realm="Stack (private)", charset="UTF-8"');
      res.status(401).send("Invalid credentials.");
      return;
    }

    next();
  });
}

app.get("/api/test", async (req, res) => {
  try {
    const rows = await getTestRows();
    res.json({ rows });
  } catch (error) {
    console.error("Failed to load test rows:", error);
    res.status(500).json({
      error: "Failed to load test rows.",
    });
  }
});

app.get("/api/airtable/status", (req, res) => {
  res.json(getAirtableSyncStatus());
});

app.post("/api/airtable/sync", async (req, res) => {
  if (AIRTABLE_SYNC_SECRET && req.headers["x-sync-secret"] !== AIRTABLE_SYNC_SECRET) {
    res.status(401).json({ error: "Invalid sync secret." });
    return;
  }

  try {
    const result = await syncDatabaseToAirtable();
    res.status(result.ok ? 200 : 503).json(result);
  } catch (error) {
    console.error("Manual Airtable sync failed:", error);
    res.status(500).json({
      ok: false,
      error: "Manual Airtable sync failed.",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

if (isProd) {
  const dist = path.join(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

async function startServer() {
  try {
    await ensureUsersTable();
  } catch (error) {
    console.error("[users] Failed to ensure users table:", error);
  }

  app.listen(PORT, () => {
    console.log(
      `Server http://localhost:${PORT} (${isProd ? "serving React build" : "API only — use Vite on :5173 for UI"})${siteLockEnabled ? " [site lock enabled]" : " [site lock disabled]"}`
    );
  });

  if (isProd) {
    startAirtableAutoSync();
  }
}

startServer();
