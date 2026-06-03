import { useAuth } from "../auth/AuthContext.jsx";
import { useEffect, useMemo, useState } from "react";
import { JournalDescription } from "./JournalDescription.jsx";
import { resolveStackAssetUrl } from "../utils/mediaUrls.js";
import "./AdminReviewPage.css";

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

function formatHours(value) {
  return Number(value ?? 0).toFixed(2);
}

const BRICKS_PER_APPROVED_HOUR = 20;

function formatDate(value) {
  if (!value) return "Shipped (unknown date)";
  return `Shipped ${new Date(value).toLocaleDateString()}`;
}

function canFullAdmin(role) {
  return role === "admin" || role === "superadmin";
}

function slackJoeToolUrl(slackId) {
  if (!slackId || typeof slackId !== "string") return null;
  const id = slackId.trim();
  if (!id) return null;
  return `https://joe.fraud.hackclub.com/profile/${encodeURIComponent(id)}`;
}

function slackDisplay(user) {
  return user?.slug ? `@${user.slug}` : user?.email || "Unknown";
}

function clampApprovalHours(value, maxHours, allowAboveMax = false) {
  if (value === "") return "";
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric < 0) return "0";
  if (!allowAboveMax && Number.isFinite(maxHours) && numeric > maxHours) return maxHours.toFixed(2);
  return value;
}

function combinedLoggedHours(project) {
  const journal = Number(project.journalHours ?? project.totalHours ?? 0);
  const hackatime = Number(project.hackatimeHours ?? 0);
  return Number(project.combinedHours ?? journal + hackatime);
}

function formatHackatimeProjectNames(names) {
  const list = (Array.isArray(names) ? names : []).map((name) => String(name).trim()).filter(Boolean);
  return list.length ? list.join(", ") : "—";
}

/** True when "new hours to approve" is above the logged/pending caps shown on the review page. */
function approvalNeedsExceedAck(project, requestedNewHours) {
  if (!project || !Number.isFinite(requestedNewHours)) return false;
  const pendingCap = Number(project.pendingReviewHours ?? 0);
  const logged = combinedLoggedHours(project);
  const banked = Math.max(Number(project.pastApprovedHours ?? 0), Number(project.approvedHours ?? 0));
  const newTotal = banked + requestedNewHours;
  return (
    requestedNewHours > pendingCap + 1e-9 ||
    requestedNewHours > logged + 1e-9 ||
    newTotal > logged + 1e-9
  );
}

export function AdminReviewPage({ projectId }) {
  if (projectId) return <AdminReviewDetail projectId={projectId} />;
  return <AdminReviewIndex />;
}

function AdminReviewIndex() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [pendingProjects, setPendingProjects] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [shipSort, setShipSort] = useState("oldest");
  const [status, setStatus] = useState("Loading review queue...");
  const [error, setError] = useState("");

  useEffect(() => {
    loadReviewProjects();
  }, [shipSort]);

  async function loadReviewProjects() {
    setStatus("Loading review queue...");
    setError("");
    try {
      const response = await fetch(`/api/admin/review/projects?shipSort=${encodeURIComponent(shipSort)}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load review projects.");
      setProjects(data.projects || []);
      setPendingProjects(data.pendingProjects || []);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  const shownProjects = activeTab === "pending" ? pendingProjects : projects;
  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return shownProjects.filter((project) => {
      const matchesStatus = statusFilter === "any" || project.status === statusFilter;
      const userBlob = [project.user?.email, project.user?.slug].filter(Boolean).join(" ");
      const searchable = `${project.name} ${project.description || ""} ${userBlob}`.toLowerCase();
      return matchesStatus && (!needle || searchable.includes(needle));
    });
  }, [search, shownProjects, statusFilter]);

  const adminHomeHref = canFullAdmin(user?.role) ? "/admin" : "/main";
  const adminHomeLabel = canFullAdmin(user?.role) ? "← Back to admin" : "← Back to platform";

  return (
    <main className="admin-review-page">
      <section className="admin-review-container">
        <a className="admin-review-back" href={adminHomeHref}>
          {adminHomeLabel}
        </a>
        <header className="admin-review-header">
          <h1>Project Reviews</h1>
          <p>Includes participant name, email, project links, hours, and shipped status.</p>
        </header>

        <input
          className="admin-review-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by project, user, email..."
        />

        <div className="admin-review-tabs-row">
          <div className="admin-review-tabs">
            <button className={activeTab === "all" ? "active" : ""} type="button" onClick={() => setActiveTab("all")}>
              All Projects ({projects.length})
            </button>
            <button className={activeTab === "pending" ? "active" : ""} type="button" onClick={() => setActiveTab("pending")}>
              Pending Review ({pendingProjects.length})
            </button>
          </div>
          <label>
            Ship date
            <select value={shipSort} onChange={(event) => setShipSort(event.target.value)}>
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="any">Any status</option>
              <option value="draft">Draft</option>
              <option value="in-review">In review</option>
              <option value="pending-reship">Pending reship</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>

        {status ? <p className="admin-review-state">{status}</p> : null}
        {error ? <p className="admin-review-state admin-review-state--error">{error}</p> : null}
        {!status && !error && filteredProjects.length === 0 ? (
          <p className="admin-review-state">{activeTab === "pending" ? "All projects have been reviewed!" : "No projects yet."}</p>
        ) : null}

        <section className="admin-review-grid">
          {filteredProjects.map((project) => (
            <a className="admin-review-card" href={`/admin/review/project/${project.id}`} key={project.id}>
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
                  {project.projectType ? <span>{project.projectType}</span> : null}
                  {project.shipped ? <span>Shipped</span> : null}
                  {project.reviewed ? <span>Reviewed</span> : null}
                  {project.fraudFlag ? <span className="admin-review-tag--fraud">Fraud flag</span> : null}
                </div>
                <footer>
                  <div className="admin-review-user">
                    <span>{(project.user?.email || "?")[0]?.toUpperCase() || "?"}</span>
                    {slackDisplay(project.user)}
                  </div>
                  <div className="admin-review-stats">
                    <strong>{formatHours(project.combinedHours ?? 0)}h</strong>
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

function AdminReviewDetail({ projectId }) {
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [approvedHours, setApprovedHours] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedAction, setSelectedAction] = useState("approve");
  const [status, setStatus] = useState("Loading project...");
  const [message, setMessage] = useState("");
  const [fraudSaving, setFraudSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [exceedModalOpen, setExceedModalOpen] = useState(false);
  const [exceedAcknowledged, setExceedAcknowledged] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    setStatus("Loading project...");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/review/projects/${projectId}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load project.");
      setProject(data.project);
      setJournalEntries(data.journalEntries || []);
      setApprovedHours("");
      setStatus("");
    } catch (err) {
      setMessage(err.message);
      setStatus("");
    }
  }

  async function persistFraudFlag(nextChecked) {
    if (!project) return;
    setFraudSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/review/projects/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fraudFlag: nextChecked }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save fraud flag.");
      setProject((current) => ({
        ...current,
        ...data.project,
        user: data.project?.user ?? current?.user,
        pendingReviewHours: data.project?.pendingReviewHours ?? current?.pendingReviewHours,
      }));
      setJournalEntries(data.journalEntries || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setFraudSaving(false);
    }
  }

  async function submitReview({ acknowledgeExceedLoggedHours = false } = {}) {
    if (!project) return;
    setMessage("");

    if (selectedAction === "reject" && !feedback.trim()) {
      setMessage("Rejection requires a written comment.");
      return;
    }

    const requestedApprovedHours = Number.parseFloat(approvedHours) || 0;
    const needsExceedAck =
      selectedAction === "approve" && approvalNeedsExceedAck(project, requestedApprovedHours);
    const hasExceedAck = acknowledgeExceedLoggedHours || exceedAcknowledged;

    if (needsExceedAck && !hasExceedAck) {
      setExceedModalOpen(true);
      setMessage('Check the acknowledgment box (below the hours field or in this dialog), then submit again.');
      return;
    }

    const endpoint =
      selectedAction === "reject"
        ? `/api/admin/review/projects/${project.id}/reject`
        : `/api/admin/review/projects/${project.id}/approve`;
    const body =
      selectedAction === "reject"
        ? { feedback }
        : {
            approvedHours: requestedApprovedHours,
            feedback,
            ...(hasExceedAck && needsExceedAck ? { acknowledgeExceedLoggedHours: true } : {}),
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit review.");
      setExceedModalOpen(false);
      setExceedAcknowledged(false);
      setProject((current) => ({
        ...current,
        ...data.project,
        user: current?.user,
        pendingReviewHours: data.project?.pendingReviewHours ?? 0,
        fraudFlag: data.project?.fraudFlag ?? current?.fraudFlag,
      }));
      setMessage(
        selectedAction === "reject"
          ? "Project rejected and returned to the participant deck."
          : `Project approved. Awarded ${data.bricksEarned} bricks.`
      );
    } catch (err) {
      setMessage(err.message);
    }
  }

  function confirmExceedAndSubmit() {
    if (!exceedAcknowledged) {
      setMessage("Check the acknowledgment box to approve above logged hours.");
      return;
    }
    setExceedModalOpen(false);
    submitReview({ acknowledgeExceedLoggedHours: true });
  }

  function handleApprovedHoursChange(rawValue) {
    if (!project) return;
    const pendingCap = Number(project.pendingReviewHours ?? 0);
    const next = clampApprovalHours(rawValue, pendingCap, true);
    setApprovedHours(next);
    const numeric = Number.parseFloat(next);
    if (Number.isFinite(numeric) && !approvalNeedsExceedAck(project, numeric)) {
      setExceedAcknowledged(false);
    }
  }

  async function deleteProjectPermanently() {
    if (!project) return;
    const ok = window.confirm(
      "Permanently delete this project and all of its journal entries from the database? This cannot be undone."
    );
    if (!ok) return;
    setDeleteBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/review/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to delete project.");
      window.location.href = "/admin/review";
    } catch (err) {
      setMessage(err.message);
      setDeleteBusy(false);
    }
  }

  if (status || !project) {
    return (
      <main className="admin-review-page">
        <section className="admin-review-container">
          <a className="admin-review-back" href="/admin/review">← Back to reviews</a>
          <p className={message ? "admin-review-state admin-review-state--error" : "admin-review-state"}>{message || status}</p>
        </section>
      </main>
    );
  }

  const isAlreadyReviewed = project.reviewed || project.status === "approved";
  const joeUrl = slackJoeToolUrl(project.user?.slackId);
  const isSuperadmin = user?.role === "superadmin";
  const newHoursMax = Number(project.pendingReviewHours ?? 0);
  const newHoursPlaceholder = formatHours(newHoursMax);
  const approvedHoursNumber = Number.parseFloat(approvedHours);
  const awardPreview = Number.isFinite(approvedHoursNumber) ? approvedHoursNumber * BRICKS_PER_APPROVED_HOUR : 0;
  const needsExceedAckPreview =
    !isAlreadyReviewed &&
    selectedAction === "approve" &&
    Number.isFinite(approvedHoursNumber) &&
    approvalNeedsExceedAck(project, approvedHoursNumber);
  const loggedHoursPreview = combinedLoggedHours(project);

  return (
    <main className="admin-review-page">
      <section className="admin-review-container admin-review-detail">
        <a className="admin-review-back" href="/admin/review">
          ← Back to reviews
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

        {project.status === "rejected" && project.adminFeedback ? (
          <section className="admin-review-panel admin-review-rejection-feedback">
            <h2>Rejection Reason</h2>
            <p>{project.adminFeedback}</p>
          </section>
        ) : null}

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
          {joeUrl ? (
            <a className="admin-review-tool-btn" href={joeUrl} target="_blank" rel="noreferrer">
              Joe
            </a>
          ) : (
            <span className="admin-review-tool-btn admin-review-tool-btn--disabled" title="Slack ID not set for this user">
              Joe (no Slack ID)
            </span>
          )}
        </section>

        <label className="admin-review-fraud">
          <input
            type="checkbox"
            checked={Boolean(project.fraudFlag)}
            disabled={fraudSaving}
            onChange={(event) => persistFraudFlag(event.target.checked)}
          />
          <span>Fraud flag</span>
          {fraudSaving ? <small className="admin-review-fraud-saving">Saving…</small> : null}
        </label>

        <section className="admin-review-panel">
          <h2>Time Tracking</h2>
          <div className="admin-review-hours-grid">
            <div>
              <span>Project</span>
              <strong>{project.name}</strong>
            </div>
            <div>
              <span>Raw Hours</span>
              <strong>{formatHours(project.combinedHours ?? 0)}</strong>
            </div>
            <div>
              <span>Previously banked</span>
              <strong>{formatHours(project.pastApprovedHours)} h</strong>
            </div>
            <div>
              <span>New hours</span>
              <strong>{newHoursPlaceholder} h</strong>
            </div>
            <div className="admin-review-hours-approve-cell">
              <span>New hours to approve</span>
              <input
                className="admin-review-hours-input"
                type="number"
                min="0"
                step="0.25"
                placeholder={newHoursPlaceholder}
                value={approvedHours}
                disabled={isAlreadyReviewed}
                onChange={(event) => handleApprovedHoursChange(event.target.value)}
              />
              <small>Only this approved amount awards bricks: {formatHours(awardPreview)} bricks</small>
              {needsExceedAckPreview ? (
                <>
                  <p className="admin-review-hours-warning">
                    Above logged hours ({formatHours(loggedHoursPreview)} h combined
                    {newHoursMax < loggedHoursPreview ? `, pending cap ${formatHours(newHoursMax)} h` : ""}).
                  </p>
                  <label className="admin-review-exceed-ack admin-review-exceed-ack--inline">
                    <input
                      type="checkbox"
                      checked={exceedAcknowledged}
                      disabled={isAlreadyReviewed}
                      onChange={(event) => setExceedAcknowledged(event.target.checked)}
                    />
                    <span>I&apos;m aware that I&apos;m giving more hours than the logged ones</span>
                  </label>
                </>
              ) : null}
            </div>
            <div>
              <span>Journal hours</span>
              <strong>{formatHours(project.journalHours)} h</strong>
            </div>
            <div>
              <span>Hackatime hours</span>
              <strong>{formatHours(project.hackatimeHours)} h</strong>
            </div>
            <div className="admin-review-hours-grid-hackatime-names">
              <span>Hackatime projects</span>
              <strong>{formatHackatimeProjectNames(project.hackatimeNames)}</strong>
            </div>
            <div>
              <span>Combined total</span>
              <strong>{formatHours((Number(project.journalHours || 0) + Number(project.hackatimeHours || 0)).toFixed(2))} h</strong>
            </div>
          </div>
        </section>

        <section className="admin-review-panel">
          <h2>Journal Entries ({journalEntries.length})</h2>
          {journalEntries.length === 0 ? (
            <p>No journal entries yet.</p>
          ) : (
            journalEntries.map((entry) => (
              <article className="admin-review-journal-entry" key={entry.id}>
                <strong>{entry.timeDone ? new Date(entry.timeDone).toLocaleString() : "N/A"} · {entry.hoursWorked}h</strong>
                <JournalDescription
                  text={entry.description}
                  className="admin-review-journal-description"
                  mediaClassName="admin-review-media-item"
                />
                {entry.toolsUsed?.length ? <small>Tools: {entry.toolsUsed.join(", ")}</small> : null}
              </article>
            ))
          )}
        </section>

        <section className="admin-review-panel">
          {isAlreadyReviewed ? (
            <p>✓ This project has already been reviewed.</p>
          ) : (
            <>
              <p>
                Approve keeps the project in the shipped queue with approved status. Reject returns it to the participant’s deck;
                you must explain what to fix.
              </p>
              <div className="admin-review-actions">
                <button className={selectedAction === "approve" ? "approve active" : "approve"} type="button" onClick={() => setSelectedAction("approve")}>
                  ✓ Approve
                </button>
                <button className={selectedAction === "reject" ? "reject active" : "reject"} type="button" onClick={() => setSelectedAction("reject")}>
                  ✗ Reject
                </button>
              </div>
              <label className="admin-review-feedback">
                Comment (optional for approve; required for reject)
                <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} />
              </label>
              <button className="admin-review-submit" type="button" onClick={() => submitReview()}>
                Submit Review
              </button>
            </>
          )}
          {message ? <p className="admin-review-state">{message}</p> : null}

          {isSuperadmin ? (
            <div className="admin-review-danger-zone">
              <h3>Superadmin</h3>
              <p>Remove this project row and related journal rows from Postgres.</p>
              <button
                className="admin-review-delete-btn"
                type="button"
                disabled={deleteBusy}
                onClick={deleteProjectPermanently}
              >
                {deleteBusy ? "Deleting…" : "Delete project from database"}
              </button>
            </div>
          ) : null}
        </section>
      </section>

      {exceedModalOpen ? (
        <div
          className="admin-review-modal-backdrop"
          role="presentation"
          onClick={() => setExceedModalOpen(false)}
        >
          <div
            className="admin-review-modal"
            role="dialog"
            aria-labelledby="admin-review-exceed-title"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="admin-review-exceed-title">Approve above logged hours?</h2>
            <p>
              You are approving <strong>{formatHours(approvedHoursNumber)} h</strong> new, but only{" "}
              <strong>{formatHours(project.combinedHours ?? 0)} h</strong> are logged (pending cap:{" "}
              {formatHours(newHoursMax)} h).
            </p>
            <label className="admin-review-exceed-ack">
              <input
                type="checkbox"
                checked={exceedAcknowledged}
                onChange={(event) => setExceedAcknowledged(event.target.checked)}
              />
              <span>I&apos;m aware that I&apos;m giving more hours than the logged ones</span>
            </label>
            <div className="admin-review-modal-actions">
              <button type="button" className="admin-review-tool-btn" onClick={() => setExceedModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-review-submit"
                disabled={!exceedAcknowledged}
                onClick={confirmExceedAndSubmit}
              >
                Approve anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
