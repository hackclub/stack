import { useEffect, useState } from "react";
import "./AdminPage.css";

export function AdminAirtableSyncPage() {
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
    <main className="admin-page" aria-label="Airtable sync admin page">
      <section className="admin-content">
        <a className="admin-back-link" href="/admin">
          ← Admin home
        </a>
        <h1>Airtable Sync</h1>

        <section className="admin-airtable">
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
      </section>
    </main>
  );
}
