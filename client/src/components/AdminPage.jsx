import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import "./AdminPage.css";

const adminLinks = [
  { href: "/admin/stats", icon: "📊", title: "Platform Statistics", desc: "Overview of projects, hours, users, and shop activity" },
  { href: "/admin/users", icon: "👥", title: "Users", desc: "Bolts, projects, hours, journals, and shop activity per participant" },
  { href: "/admin/journals", icon: "🧾", title: "Journal entries (CSV)", desc: "All journal rows in one spreadsheet, sorted by project then time" },
  { href: "/admin/review", icon: "📋", title: "Project Review", desc: "Review shipped projects and approve hours" },
  { href: "/admin/shop", icon: "🛒", title: "Shop Admin", desc: "Manage catalog, categories, and pricing" },
  { href: "/admin/shop/orders", icon: "📦", title: "Shop orders", desc: "Fulfillment queue, group by user or item, refunds" },
  { href: "/admin/items_request", icon: "📝", title: "Items Request", desc: "View Exchange Desk item requests" },
  { href: "/admin/blazer", icon: "🔍", title: "Blazer", desc: "Database queries and dashboards" },
  { href: "/admin/flipper", icon: "🚩", title: "Flipper", desc: "Feature flags" },
  { href: "/admin/jobs", icon: "⚙️", title: "Solid Queue", desc: "Background job queue" },
  { href: "#admin-airtable-sync", icon: "🔄", title: "Airtable Sync", desc: "Sync status, logs, and diagnostics" },
  { href: "/admin/console", icon: "💎", title: "Ruby Console", desc: "Execute Ruby code on the server" },
];

export function AdminPage() {
  const { user } = useAuth();
  const showSuperAdmin = user?.role === "super_admin";
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("Loading test rows...");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        await Promise.all([loadRows(), loadSyncStatus()]);
        if (isMounted) setStatus("");
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setStatus("");
        }
      }
    }

    bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadRows() {
    const response = await fetch("/api/test");
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : {};
    if (!response.ok) {
      throw new Error(data.error || "Failed to load test rows.");
    }
    setRows(data.rows || []);
  }

  async function loadSyncStatus() {
    const response = await fetch("/api/airtable/status");
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : {};
    if (!response.ok) {
      throw new Error(data.error || "Failed to load sync status.");
    }
    setSyncStatus(data);
    setSyncError("");
    return data;
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    setSyncError("");
    setSyncMessage("");
    try {
      const response = await fetch("/api/airtable/sync", { method: "POST" });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await response.json() : {};
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to sync Airtable.");
      }
      setSyncMessage("Sync finished.");
      await Promise.all([loadRows(), loadSyncStatus()]);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }

  const lastSyncTime = syncStatus?.lastSync?.syncedAt
    ? new Date(syncStatus.lastSync.syncedAt).toLocaleString()
    : "Never synced";
  const syncTables = syncStatus?.lastSync?.tables || [];
  const lastSyncError = syncStatus?.lastSync?.ok === false ? syncStatus.lastSync.error : "";

  return (
    <main className="admin-page" aria-label="Admin page">
      <section className="admin-content">
        <h1>Admin Panel</h1>

        <div className="admin-links">
          {adminLinks.map((item) => (
            <a key={item.href} href={item.href} className="admin-link">
              <span className="admin-link-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>
                {item.title}
                <span className="admin-link-desc">{item.desc}</span>
              </span>
            </a>
          ))}
        </div>

        {showSuperAdmin ? (
          <section className="admin-super">
            <div className="admin-super-icon">✦</div>
            <div className="admin-super-copy">
              <strong>Super admin</strong>
              <span>Additional tools - coming soon</span>
            </div>
          </section>
        ) : null}

        <section id="admin-airtable-sync" className="admin-airtable">
          <h2>Airtable Sync</h2>
          <p className="admin-airtable-subtitle">Re-sync Stack Airtable from the latest database state.</p>

          <div className="admin-airtable-sync-row">
            <div>
              <strong>Airtable sync</strong>
              <span>Last update: {lastSyncTime}</span>
            </div>
            <button type="button" onClick={handleSyncNow} disabled={isSyncing}>
              {isSyncing ? "Syncing..." : "Sync now"}
            </button>
          </div>

          {syncMessage ? <p className="admin-airtable-success">{syncMessage}</p> : null}
          {syncError ? <p className="admin-airtable-error">{syncError}</p> : null}
          {lastSyncError ? <p className="admin-airtable-error">Last sync error: {lastSyncError}</p> : null}
          {status ? <p>{status}</p> : null}
          {error ? <p className="admin-airtable-error">{error}</p> : null}

          {syncTables.length > 0 ? (
            <div className="admin-airtable-details">
              <strong>Sync details</strong>
              {syncTables.map((table) => (
                <p key={table.table}>
                  <code>{table.table}</code>:{" "}
                  {table.skipped
                    ? `Skipped (${table.reason})`
                    : `Synced ${table.synced}/${table.sourceRows} rows using ${table.mergeFields.join(", ")}`}
                </p>
              ))}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="admin-airtable-rows">
              {rows.map((row, index) => (
                <pre key={row.id ?? index}>{JSON.stringify(row, null, 2)}</pre>
              ))}
            </div>
          ) : null}
        </section>

        <section className="admin-silly" aria-hidden="true">
          <pre>{`(\\_/)\n(o.o)\n(> <)`}</pre>
          <p className="admin-emojis">🦄🌈🔮💎🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🪕🎻🎲🎯🎳🎮🎰🎱🔮💎🌈🦄</p>
          <p className="admin-tagline">sillies be upon ye</p>
        </section>
      </section>
    </main>
  );
}
