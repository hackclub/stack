import platformBackground from "@assets/platform/main/bkg.png";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import sideBrick from "@assets/platform/projects/side_brick.png";
import statusBtn from "@assets/platform/projects/status_btn.png";
import hoursBtn from "@assets/platform/projects/hours_btn.png";
import backBtn from "@assets/platform/common/Back_btn.png";
import nextBtn from "@assets/platform/common/nextPg_btn.png";
import stackTitle from "@assets/platform/common/Stack_title.png";
import "./ProjectsPage.css";

const PROJECTS_PER_BLOCK = 5;

const emptyProject = {
  name: "",
  description: "",
  projectType: "software",
  playableUrl: "",
  codeUrl: "",
  imageUrl: "",
};

const emptyJournalEntry = {
  timeDone: "",
  hoursWorked: "",
  description: "",
  toolsUsed: "",
};

function displayStatus(project) {
  if (project.shipped) return "Shipped";
  if (project.status === "draft") return "Draft";
  return project.status || "Draft";
}

function getShipLockReason(project) {
  if (project.shipped) return "Locked: already shipped.";
  const missing = [];
  if (!project.playableUrl) missing.push("playable URL missing");
  if (!project.codeUrl) missing.push("code URL missing");
  if (!project.imageUrl) missing.push("project image missing");
  if (Number(project.totalHours || 0) <= 0) missing.push("hours logged missing");
  return missing.length ? `Locked: ${missing.join(", ")}.` : "";
}

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [journalProject, setJournalProject] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalForm, setJournalForm] = useState(emptyJournalEntry);
  const [projectBlockPage, setProjectBlockPage] = useState(0);
  const [status, setStatus] = useState("Loading projects...");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const maxProjectBlockPage = Math.max(0, Math.ceil(projects.length / PROJECTS_PER_BLOCK) - 1);
    if (projectBlockPage > maxProjectBlockPage) {
      setProjectBlockPage(maxProjectBlockPage);
    }
  }, [projectBlockPage, projects.length]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSelectedProject(null);
        setEditingProject(null);
        setJournalProject(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  async function loadProjects() {
    setStatus("Loading projects...");
    setError("");
    try {
      const response = await fetch("/api/projects", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load projects.");
      setProjects(data.projects || []);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  async function saveProject(event) {
    event.preventDefault();
    if (!editingProject) return;

    setError("");
    const isNew = !editingProject.id;
    try {
      const response = await fetch(isNew ? "/api/projects" : `/api/projects/${editingProject.id}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProject),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save project.");
      setEditingProject(null);
      setSelectedProject(data.project);
      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteProject(project) {
    if (!project?.id || !window.confirm(`Delete ${project.name}?`)) return;

    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
      if (!response.ok) throw new Error(data.error || "Failed to delete project.");
      setSelectedProject(null);
      setEditingProject(null);
      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  async function shipProject(project) {
    const lockReason = getShipLockReason(project);
    if (lockReason) {
      setError(lockReason);
      return;
    }

    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/ship`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to ship project.");
      setProjects((current) => current.map((item) => (item.id === data.project.id ? data.project : item)));
      setSelectedProject(data.project);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openJournal(project) {
    setJournalProject(project);
    setJournalForm(emptyJournalEntry);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/journal_entries`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load journal entries.");
      setJournalEntries(data.entries || []);
    } catch (err) {
      setJournalEntries([]);
      setError(err.message);
    }
  }

  async function saveJournalEntry(event) {
    event.preventDefault();
    if (!journalProject) return;

    setError("");
    const toolsUsed = journalForm.toolsUsed
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);

    try {
      const response = await fetch(`/api/projects/${journalProject.id}/journal_entries`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeDone: journalForm.timeDone || new Date().toISOString(),
          hoursWorked: Number.parseFloat(journalForm.hoursWorked) || 0,
          description: journalForm.description,
          toolsUsed,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save journal entry.");

      setJournalForm(emptyJournalEntry);
      setJournalEntries((current) => [data.entry, ...current]);
      if (data.project) {
        setProjects((current) => current.map((project) => (project.id === data.project.id ? data.project : project)));
        setSelectedProject((current) => (current?.id === data.project.id ? data.project : current));
        setJournalProject(data.project);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const maxProjectBlockPage = Math.max(0, Math.ceil(projects.length / PROJECTS_PER_BLOCK) - 1);
  const visibleProjects = projects.slice(
    projectBlockPage * PROJECTS_PER_BLOCK,
    projectBlockPage * PROJECTS_PER_BLOCK + PROJECTS_PER_BLOCK
  );
  const hasPreviousProjectBlock = projectBlockPage > 0;
  const hasNextProjectBlock = projectBlockPage < maxProjectBlockPage;

  return (
    <main className="projects-page" aria-label="Projects page">
      <img className="projects-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <section className="projects-page__grid" aria-label="Project list">
        <button
          className="projects-page__card projects-page__card--add"
          type="button"
          onClick={() => setEditingProject(emptyProject)}
        >
          <img className="projects-page__studs" src={sideBrick} alt="" aria-hidden="true" />
          <span className="projects-page__add-plus">+</span>
          <h2 className="projects-page__title">New Project</h2>
        </button>

        {status ? <p className="projects-page__status">{status}</p> : null}
        {error ? <p className="projects-page__status projects-page__status--error">{error}</p> : null}

        {visibleProjects.map((project) => (
          <button
            className="projects-page__card"
            key={project.id}
            type="button"
            aria-label={`Open details for ${project.name}`}
            onClick={() => setSelectedProject(project)}
          >
            <img className="projects-page__studs" src={sideBrick} alt="" aria-hidden="true" />
            <h2 className="projects-page__title">{project.name}</h2>
            <div className="projects-page__meta">
              <div className="projects-page__meta-chip">
                <img src={statusBtn} alt="" aria-hidden="true" />
                <span>{displayStatus(project)}</span>
              </div>
              <div className="projects-page__meta-chip">
                <img src={hoursBtn} alt="" aria-hidden="true" />
                <span>{project.totalHours || 0} hours</span>
              </div>
            </div>
          </button>
        ))}
      </section>

      <nav className="projects-page__nav" aria-label="Projects navigation">
        <a className="projects-page__back" href="/main" aria-label="Go back to main page">
          <img src={backBtn} alt="" aria-hidden="true" />
        </a>
        {hasPreviousProjectBlock ? (
          <button
            className="projects-page__block-nav projects-page__block-nav--prev"
            type="button"
            aria-label="Go to previous project block page"
            onClick={() => setProjectBlockPage((page) => Math.max(0, page - 1))}
          >
            <img src={nextBtn} alt="" aria-hidden="true" />
          </button>
        ) : null}
        {hasNextProjectBlock ? (
          <button
            className={`projects-page__block-nav projects-page__block-nav--next${hasPreviousProjectBlock ? "" : " projects-page__block-nav--solo"}`}
            type="button"
            aria-label="Go to next project block page"
            onClick={() => setProjectBlockPage((page) => Math.min(maxProjectBlockPage, page + 1))}
          >
            <img src={nextBtn} alt="" aria-hidden="true" />
          </button>
        ) : null}
      </nav>

      <img className="projects-page__brand" src={stackTitle} alt="Stack" />

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={() => setEditingProject(selectedProject)}
          onJournal={() => openJournal(selectedProject)}
          onShip={() => shipProject(selectedProject)}
          onDelete={() => deleteProject(selectedProject)}
        />
      )}

      {editingProject && (
        <ProjectFormModal
          project={editingProject}
          onChange={(field, value) => setEditingProject((current) => ({ ...current, [field]: value }))}
          onClose={() => setEditingProject(null)}
          onSubmit={saveProject}
        />
      )}

      {journalProject && (
        <JournalModal
          project={journalProject}
          entries={journalEntries}
          form={journalForm}
          onChange={(field, value) => setJournalForm((current) => ({ ...current, [field]: value }))}
          onClose={() => setJournalProject(null)}
          onSubmit={saveJournalEntry}
        />
      )}
    </main>
  );
}

function ProjectDetailsModal({ project, onClose, onEdit, onJournal, onShip, onDelete }) {
  const shipLockReason = getShipLockReason(project);

  return (
    <div className="projects-page__modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="projects-page__modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} details`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="projects-page__modal-close" type="button" aria-label="Close project details" onClick={onClose}>
          x
        </button>

        <h2 className="projects-page__modal-title">{project.name}</h2>
        <p className="projects-page__modal-description">{project.description || "No description yet."}</p>
        {project.imageUrl ? <img className="projects-page__project-image" src={project.imageUrl} alt="" /> : null}

        <div className="projects-page__modal-row">
          <span>Type</span>
          <strong>{project.projectType || "—"}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Status</span>
          <strong>{displayStatus(project)}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hours logged</span>
          <strong>{project.totalHours || 0}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hours approved</span>
          <strong>{project.approvedHours || 0}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Journaling logged time</span>
          <strong>{project.journalHours || 0}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hackatime logged time</span>
          <strong>Blocked for now</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hackatime name</span>
          <strong>Unavailable</strong>
        </div>
        {project.playableUrl ? (
          <a className="projects-page__modal-link" href={project.playableUrl} target="_blank" rel="noreferrer">
            Playable URL
          </a>
        ) : null}
        {project.codeUrl ? (
          <a className="projects-page__modal-link" href={project.codeUrl} target="_blank" rel="noreferrer">
            Code URL
          </a>
        ) : null}

        <div className="projects-page__modal-actions">
          <button type="button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" onClick={onJournal}>
            Journal
          </button>
          <button type="button" disabled={Boolean(shipLockReason)} title={shipLockReason || "Ready to ship"} onClick={onShip}>
            Ship It
          </button>
          <button type="button" className="projects-page__danger-btn" onClick={onDelete}>
            Delete
          </button>
        </div>
        {shipLockReason ? <p className="projects-page__ship-lock">{shipLockReason}</p> : null}
      </section>
    </div>
  );
}

function JournalModal({ project, entries, form, onChange, onClose, onSubmit }) {
  return (
    <div className="projects-page__modal-overlay" role="presentation" onClick={onClose}>
      <section className="projects-page__modal projects-page__modal--journal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="projects-page__modal-close" type="button" aria-label="Close project journal" onClick={onClose}>
          x
        </button>
        <h2 className="projects-page__modal-title">{project.name} - Journal</h2>

        <form className="projects-page__form" onSubmit={onSubmit}>
          <label>
            Time Done
            <input type="datetime-local" value={form.timeDone} onChange={(event) => onChange("timeDone", event.target.value)} />
          </label>
          <label>
            Hours Worked
            <input
              type="number"
              min="0"
              step="0.25"
              value={form.hoursWorked}
              onChange={(event) => onChange("hoursWorked", event.target.value)}
              required
            />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(event) => onChange("description", event.target.value)} required />
          </label>
          <label>
            Tools Used
            <input value={form.toolsUsed} onChange={(event) => onChange("toolsUsed", event.target.value)} placeholder="React, Figma, CAD" />
          </label>
          <button type="submit">Save Entry</button>
        </form>

        <section className="projects-page__journal-list" aria-label="Journal entries">
          <h3>Journal Entries</h3>
          {entries.length === 0 ? (
            <p>No journal entries yet.</p>
          ) : (
            entries.map((entry) => (
              <article className="projects-page__journal-entry" key={entry.id}>
                <strong>
                  {entry.timeDone ? new Date(entry.timeDone).toLocaleDateString() : "N/A"} - {entry.hoursWorked || 0} hrs
                </strong>
                <p>{entry.description}</p>
                {entry.toolsUsed?.length ? <small>Tools: {entry.toolsUsed.join(", ")}</small> : null}
              </article>
            ))
          )}
        </section>
      </section>
    </div>
  );
}

function ProjectFormModal({ project, onChange, onClose, onSubmit }) {
  return (
    <div className="projects-page__modal-overlay" role="presentation" onClick={onClose}>
      <section className="projects-page__modal projects-page__modal--form" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="projects-page__modal-close" type="button" aria-label="Close project form" onClick={onClose}>
          x
        </button>
        <h2 className="projects-page__modal-title">{project.id ? "Edit Project" : "New Project"}</h2>

        <form className="projects-page__form" onSubmit={onSubmit}>
          <label>
            Project name
            <input value={project.name || ""} onChange={(event) => onChange("name", event.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={project.description || ""} onChange={(event) => onChange("description", event.target.value)} required />
          </label>
          <label>
            Type of project
            <select value={project.projectType || "software"} onChange={(event) => onChange("projectType", event.target.value)}>
              <option value="software">Software</option>
              <option value="hardware">Hardware</option>
              <option value="art">Art</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Playable URL (required before shipping)
            <input value={project.playableUrl || ""} onChange={(event) => onChange("playableUrl", event.target.value)} />
          </label>
          <label>
            Code URL (required before shipping)
            <input value={project.codeUrl || ""} onChange={(event) => onChange("codeUrl", event.target.value)} />
          </label>
          <label>
            Project image URL (required before shipping)
            <input value={project.imageUrl || ""} onChange={(event) => onChange("imageUrl", event.target.value)} />
          </label>
          <fieldset disabled className="projects-page__hackatime-disabled">
            <legend>Hackatime projects</legend>
            <p>Blocked for now: Stack does not connect Hack Club accounts yet.</p>
          </fieldset>
          <button type="submit">Save Project</button>
        </form>
      </section>
    </div>
  );
}
