import { useEffect, useMemo, useState } from "react";
import { JournalDescription } from "./JournalDescription.jsx";
import { readJsonResponse } from "../utils/fetchJson.js";
import { resolveStackAssetUrl } from "../utils/mediaUrls.js";
import "./AdminReviewPage.css";

const JOURNALING_MEDIA_ENDPOINT = "/api/journalingrecords/media";

function formatHours(value) {
  return Number(value ?? 0).toFixed(2);
}

function formatDate(value) {
  if (!value) return "Shipped (unknown date)";
  return `Shipped ${new Date(value).toLocaleDateString()}`;
}

function slackDisplay(user) {
  return user?.slug ? `@${user.slug}` : user?.email || "Unknown";
}

function ReviewImage({ src, className, alt = "" }) {
  const resolved = resolveStackAssetUrl(src);
  const [failed, setFailed] = useState(false);

  if (!resolved || failed) {
    return <span className="admin-review-image-fallback">{alt || "Image could not be loaded"}</span>;
  }

  return (
    <img
      className={className}
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function useJournalingAuth() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

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

  function handleUnauthorized() {
    setAuthenticated(false);
  }

  return {
    configured,
    authenticated,
    checkingSession,
    password,
    setPassword,
    authError,
    authBusy,
    submitPassword,
    handleUnauthorized,
  };
}

function JournalingAuthGate({ auth, children }) {
  if (auth.checkingSession) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <p className="admin-review-state">Loading…</p>
        </section>
      </main>
    );
  }

  if (!auth.configured) {
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

  if (!auth.authenticated) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <header className="admin-review-header">
            <h1>Journaling Records</h1>
            <p>Enter the password to view all journal entries.</p>
          </header>
          <form className="admin-review-panel" onSubmit={auth.submitPassword}>
            <label className="admin-review-feedback">
              Password
              <input
                className="admin-review-search"
                type="password"
                value={auth.password}
                autoComplete="current-password"
                onChange={(event) => auth.setPassword(event.target.value)}
              />
            </label>
            {auth.authError ? <p className="admin-review-state admin-review-state--error">{auth.authError}</p> : null}
            <button className="admin-review-submit" type="submit" disabled={auth.authBusy || !auth.password}>
              {auth.authBusy ? "Checking…" : "Continue"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return children;
}

function JournalingRecordsIndex({ onUnauthorized }) {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading projects...");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setStatus("Loading projects...");
    setError("");
    try {
      const response = await fetch("/api/journalingrecords/projects", { credentials: "include" });
      if (response.status === 401) {
        onUnauthorized();
        throw new Error("Session expired. Enter the password again.");
      }
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Failed to load projects.");
      setProjects(data.projects || []);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.filter((project) => {
      const userBlob = [project.user?.email, project.user?.slug].filter(Boolean).join(" ");
      const searchable = `${project.name} ${project.codeUrl || ""} ${userBlob}`.toLowerCase();
      return !needle || searchable.includes(needle);
    });
  }, [projects, search]);

  return (
    <main className="admin-review-page">
      <section className="admin-review-container">
        <header className="admin-review-header">
          <h1>Journaling Records</h1>
          <p>Browse projects with journal entries. Click a project to view its logs.</p>
        </header>

        <input
          className="admin-review-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email, repo, or project name..."
        />

        {status ? <p className="admin-review-state">{status}</p> : null}
        {error ? <p className="admin-review-state admin-review-state--error">{error}</p> : null}
        {!status && !error && filteredProjects.length === 0 ? (
          <p className="admin-review-state">No projects with journal entries found.</p>
        ) : null}

        <section className="admin-review-grid">
          {filteredProjects.map((project) => (
            <a className="admin-review-card" href={`/journalingrecords/project/${project.id}`} key={project.id}>
              <div className="admin-review-thumb">
                {project.imageUrl ? (
                  <ReviewImage src={project.imageUrl} className="" alt="" />
                ) : (
                  <span className="admin-review-image-fallback">Image could not be loaded</span>
                )}
              </div>
              <div className="admin-review-card-content">
                <div className="admin-review-card-header">
                  <h2>{project.name || "Untitled Project"}</h2>
                  <span>{project.status || "pending"}</span>
                </div>
                <p>{project.description || ""}</p>
                <div className="admin-review-tags">
                  <span>{project.journalEntryCount} journal entries</span>
                  {project.shipped ? <span>Shipped</span> : null}
                  {project.codeUrl ? <span>Repo linked</span> : null}
                </div>
                <footer>
                  <div className="admin-review-user">
                    <span>{(project.user?.email || "?")[0]?.toUpperCase() || "?"}</span>
                    {slackDisplay(project.user)}
                  </div>
                  <div className="admin-review-stats">
                    <strong>{formatHours(project.journalHours)}h</strong>
                    <small>{formatDate(project.shippedAt)}</small>
                  </div>
                </footer>
              </div>
            </a>
          ))}
        </section>
      </section>
    </main>
  );
}

function JournalingRecordsDetail({ projectId, onUnauthorized }) {
  const [project, setProject] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [status, setStatus] = useState("Loading project...");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    setStatus("Loading project...");
    setError("");
    try {
      const response = await fetch(`/api/journalingrecords/projects/${projectId}`, { credentials: "include" });
      if (response.status === 401) {
        onUnauthorized();
        throw new Error("Session expired. Enter the password again.");
      }
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Failed to load project.");
      setProject(data.project);
      setJournalEntries(data.journalEntries || []);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  if (status || !project) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <a className="admin-review-back" href="/journalingrecords">
            ← Back to projects
          </a>
          <p className={error ? "admin-review-state admin-review-state--error" : "admin-review-state"}>
            {error || status}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-review-page">
      <section className="admin-review-container admin-review-detail">
        <a className="admin-review-back" href="/journalingrecords">
          ← Back to projects
        </a>

        <header className="admin-review-header">
          <h1>{project.name}</h1>
          <p className="admin-review-participant-line">
            <strong className="admin-review-participant-email">{project.user?.email || "No email on file"}</strong>
            {project.user?.slug ? <span className="admin-review-participant-name"> · @{project.user.slug}</span> : null}
          </p>
        </header>

        {project.imageUrl ? (
          <ReviewImage src={project.imageUrl} className="admin-review-banner" alt="" />
        ) : (
          <div className="admin-review-banner admin-review-banner--empty">Screenshot unavailable</div>
        )}

        <section className="admin-review-quick-links" aria-label="Project links">
          {project.codeUrl ? (
            <a className="admin-review-tool-btn" href={project.codeUrl} target="_blank" rel="noreferrer">
              Code repo
            </a>
          ) : (
            <span className="admin-review-tool-btn admin-review-tool-btn--disabled">Code repo (missing)</span>
          )}
          {project.playableUrl ? (
            <a className="admin-review-tool-btn" href={project.playableUrl} target="_blank" rel="noreferrer">
              Live demo
            </a>
          ) : (
            <span className="admin-review-tool-btn admin-review-tool-btn--disabled">Live demo (missing)</span>
          )}
        </section>

        <section className="admin-review-panel">
          <h2>Journal Entries ({journalEntries.length})</h2>
          {journalEntries.length === 0 ? (
            <p>No journal entries yet.</p>
          ) : (
            journalEntries.map((entry) => (
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
      </section>
    </main>
  );
}

export function JournalingRecordsPage({ projectId }) {
  const auth = useJournalingAuth();

  return (
    <JournalingAuthGate auth={auth}>
      {projectId ? (
        <JournalingRecordsDetail
          projectId={projectId}
          onUnauthorized={auth.handleUnauthorized}
        />
      ) : (
        <JournalingRecordsIndex onUnauthorized={auth.handleUnauthorized} />
      )}
    </JournalingAuthGate>
  );
}
