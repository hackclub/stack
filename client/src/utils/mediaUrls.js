/**
 * Resolve project/journal asset URLs for the current app origin.
 * Rewrites dev upload hosts (127.0.0.1:3000) and relative /uploads paths
 * so images work on the Vite dev server and in production.
 */
export function resolveStackAssetUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (parsed.pathname.startsWith("/uploads/")) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }

    const isLocalUploadHost =
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
      parsed.pathname.startsWith("/uploads/");
    if (isLocalUploadHost) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }

    return parsed.href;
  } catch {
    return trimmed.startsWith("/uploads/") ? `${window.location.origin}${trimmed}` : trimmed;
  }
}

/** @param {string} url */
export function isAllowedJournalMediaUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim(), window.location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.hostname === "cdn.hackclub.com") return true;
    if (parsed.pathname.startsWith("/uploads/")) return true;
    if (parsed.hostname === window.location.hostname) return true;
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

const MARKDOWN_MEDIA_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * @param {string | null | undefined} text
 * @returns {Array<{ type: "text", value: string } | { type: "media", alt: string, url: string }>}
 */
export function parseJournalDescription(text) {
  if (!text) return [];

  const parts = [];
  let last = 0;
  let match;

  while ((match = MARKDOWN_MEDIA_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }

    const rawUrl = match[2].trim();
    if (isAllowedJournalMediaUrl(rawUrl)) {
      const resolved = resolveStackAssetUrl(rawUrl);
      if (resolved) {
        parts.push({ type: "media", alt: match[1], url: resolved });
      } else {
        parts.push({ type: "text", value: match[0] });
      }
    } else {
      parts.push({ type: "text", value: match[0] });
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }

  return parts;
}

export function isVideoUrl(url) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}
