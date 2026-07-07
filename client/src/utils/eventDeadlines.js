/** Jul 1, 2026 10:00 AM Eastern (EDT, UTC-4). */
export const SHIP_CLOSE_MS = Date.parse("2026-07-01T14:00:00Z");

/** Jul 8, 2026 3:27 AM Eastern (EDT, UTC-4) — 24.1h shop reopen window. */
export const SHOP_CLOSE_MS = Date.parse("2026-07-08T07:27:00Z");

export const SHIP_CLOSED_MESSAGE = "Shipping closed on Jul 1 at 10:00 AM ET.";
export const SHOP_CLOSED_MESSAGE = "Shop closed on Jul 8 at 3:27 AM ET.";

export function isDeadlineOpen(deadlineMs, nowMs = Date.now()) {
  return nowMs < deadlineMs;
}

export function formatDeadlineCountdown(deadlineMs, nowMs = Date.now()) {
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) return "Closed";

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`, `${minutes}m`, `${seconds}s`);
  return parts.join(" ");
}
