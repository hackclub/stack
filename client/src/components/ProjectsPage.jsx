const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
const sideBrick = "https://cdn.hackclub.com/019e3e5a-9d8a-7fcb-ad80-d6166cfd97f8/side_brick.png";
const statusBtn = "https://cdn.hackclub.com/019e3e5a-9f39-7875-aec6-cf24a58b87d4/status_btn.png";
const hoursBtn = "https://cdn.hackclub.com/019e3e5a-9b72-709a-8224-a87f14fd5e78/hours_btn.png";
const backBtn = "https://cdn.hackclub.com/019e3e5a-8541-7927-b209-5cca8c932fe6/Back_btn.png";
const nextBtn = "https://cdn.hackclub.com/019e3e5a-8982-762d-a87b-ab579f292394/nextPg_btn.png";
const stackTitle = "https://cdn.hackclub.com/019e3e5a-8745-7bee-a1ab-07b5743f98c7/Stack_title.png";
import "./ProjectsPage.css";

const PROJECTS_PER_BLOCK = 5;

function isValidUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function throwConfetti() {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const pieces = [];
  const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf", "#ff9a76", "#c7b3e5"];

  for (let i = 0; i < 50; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 4 + 3,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    for (let piece of pieces) {
      piece.y += piece.vy;
      piece.x += piece.vx;
      piece.vy += 0.15;
      piece.rotation += piece.rotationSpeed;

      if (piece.y < canvas.height + 50) {
        active = true;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        ctx.restore();
      }
    }

    if (active) {
      requestAnimationFrame(animate);
    } else {
      document.body.removeChild(canvas);
    }
  }

  animate();
}

const emptyProject = {
  name: "",
  description: "",
  projectType: "software",
  playableUrl: "",
  codeUrl: "",
  imageUrl: "",
  hackatimeNames: [],
};

const emptyJournalEntry = {
  timeDone: "",
  hoursWorked: "",
  description: "",
  toolsUsed: "",
};

const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

function isVideoUrl(url) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

function JournalDescriptionRenderer({ text }) {
  if (!text) return null;
  const parts = [];
  const imgRe = /!\[([^\]]*)\]\((https:\/\/cdn\.hackclub\.com\/[^\s)]+)\)/g;
  let last = 0;
  let match;
  while ((match = imgRe.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "media", alt: match[1], url: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });

  return (
    <div className="journal-description">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part.value}</span>
        ) : isVideoUrl(part.url) ? (
          <video key={i} className="journal-media-item" src={part.url} controls preload="metadata" />
        ) : (
          <img key={i} className="journal-media-item" src={part.url} alt={part.alt} />
        )
      )}
    </div>
  );
}

function displayStatus(project) {
  if (project.status === "approved") return "Approved";
  if (project.status === "rejected") return "Rejected";
  if (project.status === "in-review") return "In Review";
  if (project.shipped) return "Shipped";
  if (project.status === "draft") return "Draft";
  return project.status || "Draft";
}

function getShipLockReason(project) {
  const missing = [];
  if (!project.playableUrl) missing.push("playable URL missing");
  if (!project.codeUrl) missing.push("code URL missing");
  if (!project.imageUrl) missing.push("project image missing");
  const hours = Number(project.combinedHours ?? project.totalHours ?? project.journalHours ?? 0);
  if (hours <= 0) missing.push("hours logged missing");
  return missing.length ? `Locked: ${missing.join(", ")}.` : "";
}

function formatHours(value) {
  return Number(value ?? 0).toFixed(2);
}

function getLoggedHours(project) {
  return Number(project.combinedHours ?? project.totalHours ?? project.journalHours ?? 0);
}

function getApprovedBankedHours(project) {
  return Math.max(Number(project.approvedHours ?? 0), Number(project.pastApprovedHours ?? 0));
}

function getPreviouslyShippedHours(project) {
  return Math.max(Number(project.lastShippedHours ?? 0), getApprovedBankedHours(project));
}

function getUnshippedHours(project) {
  return Math.max(0, Number((getLoggedHours(project) - getPreviouslyShippedHours(project)).toFixed(2)));
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
  const [hackatimeAvailable, setHackatimeAvailable] = useState(false);
  const [hackatimeConnected, setHackatimeConnected] = useState(false);
  const [hackatimeProjects, setHackatimeProjects] = useState([]);

  useEffect(() => {
    loadProjects();
    loadHackatimeStatus();
  }, []);

  async function openEditProject(project) {
    if (project.id && hackatimeConnected) {
      try {
        const response = await fetch(`/api/projects/${project.id}`, { credentials: "include" });
        const data = response.ok ? await response.json() : null;
        if (data?.project) {
          setEditingProject({ ...data.project, hackatimeNames: data.project.hackatimeNames || [] });
          return;
        }
      } catch {
        // use cached project row
      }
    }
    setEditingProject({ ...project, hackatimeNames: project.hackatimeNames || [] });
  }

  async function loadHackatimeStatus() {
    try {
      const response = await fetch("/api/hackatime/status", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setHackatimeAvailable(Boolean(data.configured));
      setHackatimeConnected(Boolean(data.connected));
      setHackatimeProjects(data.projects || []);
    } catch {
      setHackatimeAvailable(false);
    }
  }

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
      setHackatimeAvailable(Boolean(data.hackatimeAvailable));
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
    const duplicateProject = projects.some(
      (project) =>
        project.id !== editingProject.id &&
        project.name?.trim().toLowerCase() === editingProject.name?.trim().toLowerCase()
    );
    if (duplicateProject) {
      setError("You already have a project with that name.");
      return;
    }

    if (editingProject.codeUrl && !isValidUrl(editingProject.codeUrl)) {
      setError("Code URL must be a valid URL (e.g., https://github.com/...).");
      return;
    }

    if (editingProject.playableUrl && !isValidUrl(editingProject.playableUrl)) {
      setError("Playable URL must be a valid URL.");
      return;
    }

    if (editingProject.imageUrl && !isValidUrl(editingProject.imageUrl)) {
      setError("Banner URL must be a valid URL.");
      return;
    }

    if (editingProject.shipped && (editingProject.hackatimeNames || []).length > 0) {
      const shippedHackatimeProjects = projects
        .filter((p) => p.shipped && p.id !== editingProject.id)
        .flatMap((p) => p.hackatimeNames || []);
      const duplicateHackatime = (editingProject.hackatimeNames || []).find((name) =>
        shippedHackatimeProjects.includes(name)
      );
      if (duplicateHackatime) {
        setError(`"${duplicateHackatime}" is already linked to another shipped project.`);
        return;
      }
    }

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
      throwConfetti();
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
    const hoursWorked = Number.parseFloat(journalForm.hoursWorked) || 0;
    if (hoursWorked < 0) {
      setError("Hours worked cannot be negative.");
      return;
    }

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
          hoursWorked,
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
            <h2 className="projects-page__title" title={project.name}>
              {project.name}
            </h2>
            <div className="projects-page__meta">
              <div className="projects-page__meta-chip">
                <img src={statusBtn} alt="" aria-hidden="true" />
                <span>{displayStatus(project)}</span>
              </div>
              <div className="projects-page__meta-chip">
                <img src={hoursBtn} alt="" aria-hidden="true" />
                <span>{project.combinedHours || 0} hours</span>
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
          onEdit={() => openEditProject(selectedProject)}
          onJournal={() => openJournal(selectedProject)}
          onShip={() => shipProject(selectedProject)}
          onDelete={() => deleteProject(selectedProject)}
        />
      )}

      {editingProject && (
        <ProjectFormModal
          project={editingProject}
          hackatimeAvailable={hackatimeAvailable}
          hackatimeConnected={hackatimeConnected}
          hackatimeProjects={hackatimeProjects}
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
          onChange={(field, value) => {
            if (field === "hoursWorked" && value) {
              const numValue = Number(value);
              if (numValue < 0) return;
            }
            setJournalForm((current) => ({ ...current, [field]: value }));
          }}
          onClose={() => setJournalProject(null)}
          onSubmit={saveJournalEntry}
        />
      )}
    </main>
  );
}

function ProjectDetailsModal({ project, onClose, onEdit, onJournal, onShip, onDelete }) {
  const shipLockReason = getShipLockReason(project);
  const unshippedHours = getUnshippedHours(project);

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
          <span>Hours logged (combined)</span>
          <strong>{formatHours(getLoggedHours(project))}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hours approved</span>
          <strong>{formatHours(getApprovedBankedHours(project))}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Unshipped hours</span>
          <strong>{formatHours(unshippedHours)}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Journal hours</span>
          <strong>{formatHours(project.journalHours)}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hackatime hours</span>
          <strong>{formatHours(project.hackatimeHours)}</strong>
        </div>
        <div className="projects-page__modal-row">
          <span>Hackatime projects</span>
          <strong>{(project.hackatimeNames || []).join(", ") || "—"}</strong>
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
          <button type="button" className="projects-page__danger-btn" disabled={project.shipped} title={project.shipped ? "Cannot delete shipped projects" : "Delete project"} onClick={onDelete}>
            Delete
          </button>
        </div>
        {shipLockReason ? <p className="projects-page__ship-lock">{shipLockReason}</p> : null}
      </section>
    </div>
  );
}

function JournalModal({ project, entries, form, onChange, onClose, onSubmit }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const textareaRef = useRef(null);
  const descriptionRef = useRef(form.description);
  descriptionRef.current = form.description;

  async function uploadAndInsert(file) {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      setUploadError(`Unsupported file type: ${file.type}. Use JPEG, PNG, GIF, WebP, AVIF, MP4, WebM, OGG, or MOV.`);
      return;
    }
    setUploading(true);
    setUploadError("");

    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? descriptionRef.current.length;
    const end = textarea?.selectionEnd ?? start;
    const placeholder = `![Uploading ${file.name}…]()`;
    const before = descriptionRef.current.slice(0, start);
    const after = descriptionRef.current.slice(end);
    const withPlaceholder = `${before}${placeholder}${after}`;
    onChange("description", withPlaceholder);
    descriptionRef.current = withPlaceholder;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/cdn/upload", {
        method: "POST",
        credentials: "include",
        headers: { "x-file-type": file.type },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");

      const mdLink = `![${file.name}](${data.url})`;
      const resolved = descriptionRef.current.replace(placeholder, mdLink);
      onChange("description", resolved);
      descriptionRef.current = resolved;
    } catch (err) {
      const cleaned = descriptionRef.current.replace(placeholder, "");
      onChange("description", cleaned);
      descriptionRef.current = cleaned;
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleTextareaDrop(event) {
    event.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(event.dataTransfer.files);
    for (const file of files) uploadAndInsert(file);
  }

  function handleTextareaPaste(event) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    for (const file of files) uploadAndInsert(file);
  }

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
            <div className={`journal-textarea-wrap${isDraggingOver ? " journal-textarea-wrap--drag" : ""}`}>
              <textarea
                ref={textareaRef}
                value={form.description}
                onChange={(event) => onChange("description", event.target.value)}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleTextareaDrop}
                onPaste={handleTextareaPaste}
                required
                placeholder="Describe what you worked on… drag & drop or paste images/videos to attach them inline"
              />
              {isDraggingOver && (
                <div className="journal-textarea-drop-overlay" aria-hidden="true">Drop to upload</div>
              )}
              {uploading && (
                <div className="journal-textarea-uploading" aria-live="polite">Uploading…</div>
              )}
            </div>
            {uploadError ? <p className="journal-upload-error">{uploadError}</p> : null}
            <small className="journal-upload-hint-text">Drag &amp; drop or paste images/videos to embed them inline</small>
          </label>
          <label>
            Tools Used
            <input value={form.toolsUsed} onChange={(event) => onChange("toolsUsed", event.target.value)} placeholder="React, Figma, CAD" />
          </label>
          <button type="submit" disabled={uploading}>Save Entry</button>
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
                <JournalDescriptionRenderer text={entry.description} />
                {entry.toolsUsed?.length ? <small>Tools: {entry.toolsUsed.join(", ")}</small> : null}
              </article>
            ))
          )}
        </section>
      </section>
    </div>
  );
}

function toggleHackatimeName(currentNames, name) {
  const set = new Set(currentNames || []);
  if (set.has(name)) set.delete(name);
  else set.add(name);
  return [...set];
}

function ProjectFormModal({
  project,
  hackatimeAvailable,
  hackatimeConnected,
  hackatimeProjects,
  onChange,
  onClose,
  onSubmit,
}) {
  const [allProjects, setAllProjects] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/projects", { credentials: "include" });
        const data = await response.json();
        setAllProjects(data.projects || []);
      } catch {
        setAllProjects([]);
      }
    })();
  }, []);

  const usedHackatimeNames = new Set(
    allProjects
      .filter((p) => p.shipped && p.id !== project.id)
      .flatMap((p) => p.hackatimeNames || [])
  );

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
            <input type="url" value={project.playableUrl || ""} onChange={(event) => onChange("playableUrl", event.target.value)} />
          </label>
          <label>
            Code URL (required before shipping)
            <input type="url" value={project.codeUrl || ""} onChange={(event) => onChange("codeUrl", event.target.value)} />
          </label>
          <label>
            Project image URL (required before shipping)
            <input type="url" value={project.imageUrl || ""} onChange={(event) => onChange("imageUrl", event.target.value)} />
          </label>
          <fieldset
            disabled={!hackatimeConnected}
            className={hackatimeConnected ? "projects-page__hackatime" : "projects-page__hackatime-disabled"}
          >
            <legend>Hackatime projects</legend>
            {!hackatimeAvailable ? (
              <p>Hackatime OAuth is not configured on this server.</p>
            ) : !hackatimeConnected ? (
              <p>
                Connect Hackatime on your next login, or{" "}
                <a href="/api/auth/hackatime/login?returnTo=/projects">connect now</a>.
              </p>
            ) : hackatimeProjects.length === 0 ? (
              <p>No Hackatime projects found on your account yet.</p>
            ) : (
              <div className="projects-page__hackatime-list">
                {hackatimeProjects.map((ht) => {
                  const checked = (project.hackatimeNames || []).includes(ht.name);
                  const isUsedElsewhere = usedHackatimeNames.has(ht.name) && !checked;
                  return (
                    <label key={ht.name} className="projects-page__hackatime-option" style={isUsedElsewhere ? { opacity: 0.5, pointerEvents: "none" } : {}}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isUsedElsewhere}
                        onChange={() =>
                          onChange("hackatimeNames", toggleHackatimeName(project.hackatimeNames, ht.name))
                        }
                      />
                      <span>
                        {ht.name} ({ht.totalHours} h){isUsedElsewhere ? " — already used" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {Number(project.hackatimeHours) > 0 ? (
              <p className="projects-page__hackatime-summary">Linked Hackatime: {project.hackatimeHours} h</p>
            ) : null}
          </fieldset>
          <button type="submit">Save Project</button>
        </form>
      </section>
    </div>
  );
}
