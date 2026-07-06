import { useEffect, useMemo, useState } from "react";
import { JournalDescription } from "./JournalDescription.jsx";
import { readJsonResponse } from "../utils/fetchJson.js";
import "./AdminReviewPage.css";

const JOURNALING_MEDIA_ENDPOINT = "/api/journalingrecords/media";

function slackDisplay(user) {
  return user?.slug ? `@${user.slug}` : user?.email || "Unknown";
}

export function JournalingRecordsPage() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadRecords();
    }
  }, [authenticated]);

  async function checkSession() {
    setCheckingSession(true);
    try {
      const response = await fetch("/api/journalingrecords/session", { credentials: "include" });
      if (response.status === 503) {
        setConfigured(false);
        setAuthenticated(false);
        return;
      }
      const data = await readJsonResponse(response);
      setConfigured(true);
      setAuthenticated(Boolean(data.authenticated));
    } catch {
      setConfigured(false);
      setAuthenticated(false);
    } finally {
      setCheckingSession(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/journalingrecords/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Incorrect password.");
      setAuthenticated(true);
      setPassword("");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function loadRecords() {
    setStatus("Loading journal entries...");
    setError("");
    try {
      const response = await fetch("/api/journalingrecords", { credentials: "include" });
      if (response.status === 401) {
        setAuthenticated(false);
        setGroups([]);
        throw new Error("Session expired. Enter the password again.");
      }
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Failed to load journal entries.");
      setGroups(data.groups || []);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;

    return groups
      .map((group) => {
        const userBlob = [group.user?.email, group.user?.slug].filter(Boolean).join(" ");
        const groupBlob = `${group.projectName} ${userBlob}`.toLowerCase();
        const matchingEntries = group.entries.filter((entry) => {
          const entryBlob = [
            entry.description,
            entry.toolsUsed?.join(" "),
            entry.timeDone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return entryBlob.includes(needle) || groupBlob.includes(needle);
        });
        if (matchingEntries.length === 0 && !groupBlob.includes(needle)) return null;
        return {
          ...group,
          entries: matchingEntries.length > 0 ? matchingEntries : group.entries,
        };
      })
      .filter(Boolean);
  }, [groups, search]);

  const totalEntries = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.entries.length, 0),
    [filteredGroups]
  );

  if (checkingSession) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <p className="admin-review-state">Loading…</p>
        </section>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <header className="admin-review-header">
            <h1>Journaling Records</h1>
            <p className="admin-review-state admin-review-state--error">
              Access is not configured. Set <code>journalingPW</code> in the server environment.
            </p>
          </header>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <header className="admin-review-header">
            <h1>Journaling Records</h1>
            <p>Enter the password to view all journal entries.</p>
          </header>
          <form className="admin-review-panel" onSubmit={submitPassword}>
            <label className="admin-review-feedback">
              Password
              <input
                className="admin-review-search"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {authError ? <p className="admin-review-state admin-review-state--error">{authError}</p> : null}
            <button className="admin-review-submit" type="submit" disabled={authBusy || !password}>
              {authBusy ? "Checking…" : "Continue"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-review-page">
      <section className="admin-review-container">
        <header className="admin-review-header">
          <h1>Journaling Records</h1>
          <p>
            All journal entries across projects ({totalEntries} entries in {filteredGroups.length} projects).
          </p>
          <button
            className="admin-review-tool-btn"
            type="button"
            onClick={async () => {
              await fetch("/api/journalingrecords/logout", {
                method: "POST",
                credentials: "include",
              });
              setAuthenticated(false);
              setGroups([]);
            }}
          >
            Lock page
          </button>
        </header>

        <input
          className="admin-review-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by project, user, email, description, tools..."
        />

        {status ? <p className="admin-review-state">{status}</p> : null}
        {error ? <p className="admin-review-state admin-review-state--error">{error}</p> : null}
        {!status && !error && filteredGroups.length === 0 ? (
          <p className="admin-review-state">No journal entries found.</p>
        ) : null}

        {filteredGroups.map((group) => (
          <section className="admin-review-panel" key={`${group.projectName}-${group.user?.email ?? "unknown"}`}>
            <h2>
              {group.projectName}
              <span className="admin-review-participant-name">
                {" "}
                · {group.user?.email || "No email on file"}
                {group.user?.slug ? ` · @${group.user.slug}` : ""}
              </span>
            </h2>
            <p className="admin-review-participant-line">
              <strong>{slackDisplay(group.user)}</strong>
              <span className="admin-review-participant-name"> · {group.entries.length} entries</span>
            </p>
            {group.entries.length === 0 ? (
              <p>No journal entries for this project.</p>
            ) : (
              group.entries.map((entry) => (
                <article className="admin-review-journal-entry" key={entry.id}>
                  <strong>
                    {entry.timeDone ? new Date(entry.timeDone).toLocaleString() : "N/A"} · {entry.hoursWorked}h
                  </strong>
                  <JournalDescription
                    text={entry.description}
                    className="admin-review-journal-description"
                    mediaClassName="admin-review-media-item"
                    mediaEndpoint={JOURNALING_MEDIA_ENDPOINT}
                  />
                  {entry.toolsUsed?.length ? <small>Tools: {entry.toolsUsed.join(", ")}</small> : null}
                </article>
              ))
            )}
          </section>
        ))}
      </section>
    </main>
  );
}
