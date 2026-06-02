export const CDN_UPLOAD_HELP =
  "To upload imgs and videos, use #cdn on Slack, and paste the link here!";

export function isHackClubCdnUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && parsed.hostname === "cdn.hackclub.com";
  } catch {
    return false;
  }
}

export function normalizeHackClubCdnUrl(value) {
  if (!isHackClubCdnUrl(value)) return null;
  return new URL(value.trim()).href;
}

export function markdownImageForCdnUrl(url) {
  const clean = normalizeHackClubCdnUrl(url);
  if (!clean) return null;
  const name = decodeURIComponent(clean.split("/").pop()?.split("?")[0] || "attachment");
  return `![${name}](${clean})`;
}

const MARKDOWN_MEDIA_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

export function journalDescriptionMediaIsCdnOnly(description) {
  if (!description || typeof description !== "string") return true;

  let match;
  const re = new RegExp(MARKDOWN_MEDIA_RE.source, "g");
  while ((match = re.exec(description)) !== null) {
    const target = match[1].trim();
    if (!target) return false;
    if (!isHackClubCdnUrl(target)) return false;
  }

  return true;
}
