import { useEffect, useState } from "react";
import "./TestPage.css";

export function TestPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("Loading test rows...");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      try {
        const response = await fetch("/api/test");
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const data = isJson ? await response.json() : {};

        if (!response.ok) {
          throw new Error(data.error || "Failed to load test rows.");
        }

        if (isMounted) {
          setRows(data.rows || []);
          setStatus("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setStatus("");
        }
      }
    }

    async function loadSyncStatus() {
      try {
        const response = await fetch("/api/airtable/status");
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const data = isJson ? await response.json() : {};

        if (!response.ok) {
          throw new Error(data.error || "Failed to load sync status.");
        }

        if (isMounted) {
          setSyncStatus(data);
          setSyncError("");
        }
      } catch (err) {
        if (isMounted) {
          setSyncError(err.message);
        }
      }
    }

    loadRows();
    loadSyncStatus();

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
      const response = await fetch("/api/airtable/sync", {
        method: "POST",
      });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await response.json() : {};

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to sync Airtable.");
      }

      setSyncMessage("Sync finished.");
      setSyncStatus((currentStatus) => ({
        ...currentStatus,
        lastSync: data,
      }));
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
    <main className="test-page">
      <section className="test-page__card">
        <h1>Test Table</h1>
        <p>Rows from the production Postgres <code>test</code> table.</p>

        <div className="test-page__sync">
          <div>
            <strong>Airtable sync</strong>
            <span>Last update: {lastSyncTime}</span>
          </div>
          <button type="button" onClick={handleSyncNow} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync now"}
          </button>
        </div>

        {syncMessage && <p className="test-page__success">{syncMessage}</p>}
        {syncError && <p className="test-page__error">{syncError}</p>}
        {lastSyncError && <p className="test-page__error">Last sync error: {lastSyncError}</p>}

        {syncTables.length > 0 && (
          <div className="test-page__sync-details">
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
        )}

        {status && <p>{status}</p>}
        {error && <p className="test-page__error">{error}</p>}

        {!status && !error && rows.length === 0 && <p>No rows found.</p>}

        {rows.length > 0 && (
          <div className="test-page__rows">
            {rows.map((row, index) => (
              <pre key={row.id ?? index}>{JSON.stringify(row, null, 2)}</pre>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
