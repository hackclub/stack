import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { checkDatabaseConnection, getTestRows } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";
const LOCK_USERNAME = process.env.SITE_LOCK_USERNAME;
const LOCK_PASSWORD = process.env.SITE_LOCK_PASSWORD;
const siteLockEnabled = Boolean(LOCK_USERNAME && LOCK_PASSWORD);

app.use(express.json());

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
    if (req.path === "/api/health" || req.path === "/api/db/health") {
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

if (isProd) {
  const dist = path.join(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(
    `Server http://localhost:${PORT} (${isProd ? "serving React build" : "API only — use Vite on :5173 for UI"})${siteLockEnabled ? " [site lock enabled]" : " [site lock disabled]"}`
  );
});
