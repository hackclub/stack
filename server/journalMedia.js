import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, "uploads");
const UPLOAD_SUBDIRS = ["cdn", "project-images"];
const MAX_PROXY_BYTES = 26 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
};

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function normalizeRemoteUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (parsed.hostname === "cdn.hackclub.com" && parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    const segments = parsed.pathname.split("/");
    parsed.pathname = segments
      .map((segment) => {
        if (!segment) return segment;
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
    return parsed.href;
  } catch {
    return null;
  }
}

function isAllowedMediaUrl(urlString) {
  const normalized = normalizeRemoteUrl(urlString);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname.startsWith("/uploads/")) return true;
    if (parsed.hostname === "cdn.hackclub.com") return true;
    if (parsed.hostname.endsWith(".hackclub.com")) return true;
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") return true;
    return false;
  } catch {
    return false;
  }
}

function uploadsPathFromUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (!parsed.pathname.startsWith("/uploads/")) return null;
    const relative = parsed.pathname.slice("/uploads/".length);
    if (relative.includes("..")) return null;
    return path.join(UPLOADS_ROOT, relative);
  } catch {
    return null;
  }
}

async function readLocalFileSafe(absolutePath) {
  const resolved = path.resolve(absolutePath);
  const root = path.resolve(UPLOADS_ROOT);
  if (!resolved.startsWith(root)) return null;

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile() || stat.size > MAX_PROXY_BYTES) return null;
    const buffer = await fs.readFile(resolved);
    return { buffer, contentType: mimeFromPath(resolved) };
  } catch {
    return null;
  }
}

async function findLocalByBasename(basename) {
  if (!basename || basename.includes("..")) return null;
  const needle = basename.trim().toLowerCase();

  for (const subdir of UPLOAD_SUBDIRS) {
    const dir = path.join(UPLOADS_ROOT, subdir);
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }

    const exact = entries.find((name) => name.toLowerCase() === needle);
    if (exact) {
      const hit = await readLocalFileSafe(path.join(dir, exact));
      if (hit) return hit;
    }

    const partial = entries.find((name) => name.toLowerCase().includes(needle.replace(/\.[a-z0-9]+$/i, "")));
    if (partial) {
      const hit = await readLocalFileSafe(path.join(dir, partial));
      if (hit) return hit;
    }
  }

  return null;
}

async function fetchRemote(urlString) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(urlString, {
      signal: controller.signal,
      headers: { Accept: "image/*,video/*,*/*" },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_PROXY_BYTES) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PROXY_BYTES) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    return { buffer, contentType: contentType.split(";")[0].trim() };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve journal / review attachment bytes for staff (CDN fetch + local uploads).
 */
export async function resolveJournalMediaPayload({ url, filename }) {
  const normalized = url ? normalizeRemoteUrl(url) : null;

  if (normalized) {
    const localFromPath = uploadsPathFromUrl(normalized);
    if (localFromPath) {
      const local = await readLocalFileSafe(localFromPath);
      if (local) return local;
    }

    try {
      const parsed = new URL(normalized);
      if (!parsed.pathname.startsWith("/uploads/")) {
        const remote = await fetchRemote(parsed.href);
        if (remote) return remote;
      }
    } catch {
      // fall through
    }

    const basename = (() => {
      try {
        return path.basename(new URL(normalized).pathname);
      } catch {
        return null;
      }
    })();
    if (basename) {
      const byName = await findLocalByBasename(basename);
      if (byName) return byName;
    }
  }

  if (filename) {
    const byFilename = await findLocalByBasename(filename);
    if (byFilename) return byFilename;
  }

  return null;
}

export async function streamJournalMediaForReview(req, res) {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  const filename = typeof req.query.filename === "string" ? req.query.filename : "";

  if (!url && !filename) {
    res.status(400).json({ error: "Missing url or filename." });
    return;
  }

  if (url && !isAllowedMediaUrl(url)) {
    res.status(403).json({ error: "URL is not allowed." });
    return;
  }

  const payload = await resolveJournalMediaPayload({ url, filename });
  if (!payload) {
    res.status(404).json({ error: "Media not found." });
    return;
  }

  res.setHeader("Content-Type", payload.contentType);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(payload.buffer);
}
