import "./env.js";
import cookieParser from "cookie-parser";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { createAuthRouter } from "./authRoutes.js";
import { getAirtableSyncStatus, syncDatabaseToAirtable } from "./airtable.js";
import { getPeriodicAirtableSyncStatus, startPeriodicAirtableSync, syncAllUsersAndProjectsToAirtable } from "./airtablePeriodic.js";
import { isHackatimeOAuthConfigured } from "./hackatimeAuth.js";
import { getHackatimeStatusForUser, listHackatimeProjectsForUser } from "./hackatimeService.js";
import { checkDatabaseConnection, getTestRows } from "./db.js";
import { adjustUserBricks, ensureAuditLogTable, getAdminStats, getAuditLogForTarget } from "./adminStats.js";
import {
  createShopItem,
  deleteShopItem,
  ensureShopItemsTable,
  listShopItems,
  listShopOrders,
  markShopOrderFulfilled,
  purchaseShopItemForUser,
  setAllShopItemsActive,
  updateShopItem,
} from "./shopItems.js";
import {
  approveAdminReviewProject,
  blockAdminReviewProject,
  createProjectForUser,
  getProjectForUser,
  createJournalEntryForUser,
  deleteProjectForUser,
  deleteProjectBySuperadmin,
  ensureProjectsTable,
  getAdminReviewProject,
  getJournalEntriesCsv,
  listJournalEntriesForUserProject,
  listAdminReviewProjects,
  patchAdminReviewProjectFlags,
  listProjectsForUser,
  rejectAdminReviewProject,
  shipProjectForUser,
  updateProjectForUser,
} from "./projects.js";
import {
  canAccessFullAdmin,
  canAccessStaffReview,
  canPerformDestructiveAdmin,
  effectiveRole,
  ensureUsersTable,
  getAdminUserById,
  getAdminUserWithProjects,
  getUserById,
  listAdminUsers,
} from "./users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
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
  throw new Error("[session] SESSION_SECRET must be set in production.");
}

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");
  next();
});

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
const authRouter = createAuthRouter();
app.use("/api/auth", authRouter);
app.use("/auth", authRouter);

async function requireFullAdmin(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const row = await getUserById(userId);
    if (!canAccessFullAdmin(effectiveRole(row))) {
      res.status(403).json({ error: "Admin only." });
      return;
    }
    next();
  } catch (error) {
    console.error("[admin] auth check failed:", error);
    res.status(500).json({ error: "Failed to verify admin access." });
  }
}

async function requireStaffReview(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const row = await getUserById(userId);
    if (!canAccessStaffReview(effectiveRole(row))) {
      res.status(403).json({ error: "Staff review access only." });
      return;
    }
    next();
  } catch (error) {
    console.error("[review] auth check failed:", error);
    res.status(500).json({ error: "Failed to verify review access." });
  }
}

async function requireSuperAdmin(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const row = await getUserById(userId);
    if (!canPerformDestructiveAdmin(effectiveRole(row))) {
      res.status(403).json({ error: "Superadmin only." });
      return;
    }
    next();
  } catch (error) {
    console.error("[superadmin] auth check failed:", error);
    res.status(500).json({ error: "Failed to verify superadmin access." });
  }
}

function requireUser(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

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

app.get("/api/shop/items", async (req, res) => {
  try {
    const items = await listShopItems();
    res.json({ items });
  } catch (error) {
    console.error("Failed to load shop items:", error);
    res.status(500).json({ error: "Failed to load shop items." });
  }
});

app.post("/api/shop/items/:id/buy", requireUser, async (req, res) => {
  try {
    const purchase = await purchaseShopItemForUser(req.session.userId, req.params.id, req.body);
    res.json({ purchase });
  } catch (error) {
    console.error("Failed to buy shop item:", error);
    res.status(400).json({ error: error.message || "Failed to buy shop item." });
  }
});

app.get("/api/projects", requireUser, async (req, res) => {
  try {
    const projects = await listProjectsForUser(req.session.userId);
    res.json({ projects, hackatimeAvailable: isHackatimeOAuthConfigured() });
  } catch (error) {
    console.error("Failed to load projects:", error);
    res.status(500).json({ error: "Failed to load projects." });
  }
});

app.post("/api/projects", requireUser, async (req, res) => {
  try {
    const project = await createProjectForUser(req.session.userId, req.body);
    res.status(201).json({ project });
  } catch (error) {
    console.error("Failed to create project:", error);
    res.status(500).json({ error: error.message || "Failed to create project." });
  }
});

app.get("/api/projects/:id", requireUser, async (req, res) => {
  try {
    const project = await getProjectForUser(req.session.userId, req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ project, hackatimeAvailable: isHackatimeOAuthConfigured() });
  } catch (error) {
    console.error("Failed to load project:", error);
    res.status(500).json({ error: "Failed to load project." });
  }
});

app.get("/api/hackatime/status", requireUser, async (req, res) => {
  try {
    const status = await getHackatimeStatusForUser(req.session.userId);
    res.json(status);
  } catch (error) {
    console.error("Failed to load Hackatime status:", error);
    res.status(500).json({ error: "Failed to load Hackatime status." });
  }
});

app.get("/api/hackatime/projects", requireUser, async (req, res) => {
  try {
    const projects = await listHackatimeProjectsForUser(req.session.userId);
    res.json({ projects });
  } catch (error) {
    console.error("Failed to load Hackatime projects:", error);
    res.status(500).json({ error: error.message || "Failed to load Hackatime projects." });
  }
});

app.patch("/api/projects/:id", requireUser, async (req, res) => {
  try {
    const project = await updateProjectForUser(req.session.userId, req.params.id, req.body);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ project });
  } catch (error) {
    console.error("Failed to update project:", error);
    res.status(500).json({ error: error.message || "Failed to update project." });
  }
});

app.post("/api/projects/:id/ship", requireUser, async (req, res) => {
  try {
    const project = await shipProjectForUser(req.session.userId, req.params.id);
    res.json({ project });
  } catch (error) {
    console.error("Failed to ship project:", error);
    res.status(400).json({ error: error.message || "Failed to ship project." });
  }
});

app.delete("/api/projects/:id", requireUser, async (req, res) => {
  try {
    const deleted = await deleteProjectForUser(req.session.userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    res.status(500).json({ error: "Failed to delete project." });
  }
});

app.get("/api/projects/:id/journal_entries", requireUser, async (req, res) => {
  try {
    const entries = await listJournalEntriesForUserProject(req.session.userId, req.params.id);
    res.json({ entries });
  } catch (error) {
    console.error("Failed to load journal entries:", error);
    res.status(500).json({ error: "Failed to load journal entries." });
  }
});

app.post("/api/projects/:id/journal_entries", requireUser, async (req, res) => {
  try {
    const result = await createJournalEntryForUser(req.session.userId, {
      ...req.body,
      projectId: req.params.id,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Failed to create journal entry:", error);
    res.status(500).json({ error: error.message || "Failed to create journal entry." });
  }
});

app.get("/api/admin/journals.csv", requireFullAdmin, async (req, res) => {
  try {
    const csv = await getJournalEntriesCsv();
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="stack-journal-entries-${today}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Failed to export journal entries:", error);
    res.status(500).json({ error: "Failed to export journal entries." });
  }
});

app.get("/api/admin/review/projects", requireStaffReview, async (req, res) => {
  try {
    const review = await listAdminReviewProjects({ shipSort: req.query.shipSort });
    res.json(review);
  } catch (error) {
    console.error("Failed to load review projects:", error);
    res.status(500).json({ error: "Failed to load review projects." });
  }
});

app.get("/api/admin/review/projects/:id", requireStaffReview, async (req, res) => {
  try {
    const reviewProject = await getAdminReviewProject(req.params.id);
    if (!reviewProject) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(reviewProject);
  } catch (error) {
    console.error("Failed to load review project:", error);
    res.status(500).json({ error: "Failed to load review project." });
  }
});

app.post("/api/admin/review/projects/:id/approve", requireStaffReview, async (req, res) => {
  try {
    const result = await approveAdminReviewProject(req.session.userId, req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error("Failed to approve review project:", error);
    res.status(400).json({ error: error.message || "Failed to approve project." });
  }
});

app.post("/api/admin/review/projects/:id/reject", requireStaffReview, async (req, res) => {
  try {
    const project = await rejectAdminReviewProject(req.session.userId, req.params.id, req.body);
    res.json({ project });
  } catch (error) {
    console.error("Failed to reject review project:", error);
    res.status(400).json({ error: error.message || "Failed to reject project." });
  }
});

app.post("/api/admin/review/projects/:id/block", requireStaffReview, async (req, res) => {
  try {
    const project = await blockAdminReviewProject(req.session.userId, req.params.id, req.body);
    res.json({ project });
  } catch (error) {
    console.error("Failed to block review project:", error);
    res.status(400).json({ error: error.message || "Failed to block project." });
  }
});

app.patch("/api/admin/review/projects/:id", requireStaffReview, async (req, res) => {
  try {
    const reviewProject = await patchAdminReviewProjectFlags(req.params.id, req.body);
    res.json(reviewProject);
  } catch (error) {
    console.error("Failed to update review project:", error);
    res.status(400).json({ error: error.message || "Failed to update project." });
  }
});

app.delete("/api/admin/review/projects/:id", requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await deleteProjectBySuperadmin(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete review project:", error);
    res.status(500).json({ error: "Failed to delete project." });
  }
});

app.get("/api/admin/shop/items", requireFullAdmin, async (req, res) => {
  try {
    const items = await listShopItems({ includeInactive: true });
    res.json({ items });
  } catch (error) {
    console.error("Failed to load admin shop items:", error);
    res.status(500).json({ error: "Failed to load admin shop items." });
  }
});

app.post("/api/admin/shop/items", requireFullAdmin, async (req, res) => {
  try {
    const item = await createShopItem(req.body);
    res.status(201).json({ item });
  } catch (error) {
    console.error("Failed to create shop item:", error);
    res.status(500).json({ error: "Failed to create shop item." });
  }
});

app.patch("/api/admin/shop/items/:id", requireFullAdmin, async (req, res) => {
  try {
    const item = await updateShopItem(req.params.id, req.body);
    if (!item) {
      res.status(404).json({ error: "Shop item not found." });
      return;
    }
    res.json({ item });
  } catch (error) {
    console.error("Failed to update shop item:", error);
    res.status(500).json({ error: "Failed to update shop item." });
  }
});

app.delete("/api/admin/shop/items/:id", requireFullAdmin, async (req, res) => {
  try {
    const deleted = await deleteShopItem(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Shop item not found." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete shop item:", error);
    res.status(500).json({ error: "Failed to delete shop item." });
  }
});

app.post("/api/admin/shop/items/bulk_active", requireFullAdmin, async (req, res) => {
  try {
    await setAllShopItemsActive(req.body?.active);
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to bulk update shop items:", error);
    res.status(500).json({ error: "Failed to update shop items." });
  }
});

app.get("/api/admin/shop/orders", requireFullAdmin, async (req, res) => {
  try {
    const orders = await listShopOrders();
    res.json({ orders });
  } catch (error) {
    console.error("Failed to load shop orders:", error);
    res.status(500).json({ error: "Failed to load shop orders." });
  }
});

app.post("/api/admin/shop/orders/:id/fulfill", requireFullAdmin, async (req, res) => {
  try {
    const order = await markShopOrderFulfilled(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    res.json({ order });
  } catch (error) {
    console.error("Failed to fulfill shop order:", error);
    res.status(500).json({ error: "Failed to fulfill order." });
  }
});

app.get("/api/admin/stats", requireFullAdmin, async (req, res) => {
  try {
    const stats = await getAdminStats();
    res.json({ stats });
  } catch (error) {
    console.error("Failed to load admin stats:", error);
    res.status(500).json({ error: "Failed to load stats." });
  }
});

app.get("/api/admin/users", requireFullAdmin, async (req, res) => {
  try {
    const users = await listAdminUsers();
    res.json({ users });
  } catch (error) {
    console.error("Failed to load admin users:", error);
    res.status(500).json({ error: "Failed to load users." });
  }
});

app.get("/api/admin/users/:id", requireFullAdmin, async (req, res) => {
  try {
    const user = await getAdminUserWithProjects(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json({ user });
  } catch (error) {
    console.error("Failed to load admin user:", error);
    res.status(500).json({ error: "Failed to load user." });
  }
});

app.patch("/api/admin/users/:id/balance", requireFullAdmin, async (req, res) => {
  const adminUserId = req.session?.userId;
  try {
    const { delta, reason } = req.body;
    const parsedDelta = Number(delta);
    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      res.status(400).json({ error: "delta must be a non-zero number." });
      return;
    }
    const updated = await adjustUserBricks(adminUserId, req.params.id, { delta: parsedDelta, reason });
    console.log(`[admin] balance_adjustment user=${req.params.id} delta=${parsedDelta} by admin=${adminUserId}`);
    res.json({ user: updated });
  } catch (error) {
    console.error("Failed to adjust user balance:", error);
    res.status(400).json({ error: error.message || "Failed to adjust balance." });
  }
});

app.get("/api/admin/users/:id/audit", requireFullAdmin, async (req, res) => {
  try {
    const entries = await getAuditLogForTarget("user", req.params.id);
    res.json({ entries });
  } catch (error) {
    console.error("Failed to load audit log:", error);
    res.status(500).json({ error: "Failed to load audit log." });
  }
});

app.get("/api/airtable/status", (req, res) => {
  res.json({
    ...getAirtableSyncStatus(),
    periodic: getPeriodicAirtableSyncStatus(),
  });
});

app.post("/api/airtable/sync", async (req, res) => {
  const secretMatch = AIRTABLE_SYNC_SECRET && req.headers["x-sync-secret"] === AIRTABLE_SYNC_SECRET;
  const isAdmin = req.session?.userId
    ? await getUserById(req.session.userId).then((row) => canAccessFullAdmin(effectiveRole(row))).catch(() => false)
    : false;
  if (!secretMatch && !isAdmin) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const result = await syncAllUsersAndProjectsToAirtable();
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
    await ensureProjectsTable();
    await ensureShopItemsTable();
    await ensureAuditLogTable();
    console.log("[db] Database schema is up to date.");
  } catch (error) {
    console.error("[db] Failed to ensure database tables:", error);
    if (isProd) {
      throw error;
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(
      `Server http://${HOST}:${PORT} (${isProd ? "serving React build" : "API only — use Vite on :5173 for UI"})${siteLockEnabled ? " [site lock enabled]" : " [site lock disabled]"}`
    );
  });

  startPeriodicAirtableSync();
}

startServer();
