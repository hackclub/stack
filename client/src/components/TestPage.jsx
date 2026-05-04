import { useEffect, useState } from "react";
import "./TestPage.css";

export function TestPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("Loading test rows...");
  const [error, setError] = useState("");

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

    loadRows();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="test-page">
      <section className="test-page__card">
        <h1>Test Table</h1>
        <p>Rows from the production Postgres <code>test</code> table.</p>

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
