/** Jul 1, 2026 10:00 AM Eastern (EDT, UTC-4). */
export const SHIP_CLOSE_UTC = new Date("2026-07-01T14:00:00Z");

/** Jul 8, 2026 3:27 AM Eastern (EDT, UTC-4) — 24.1h shop reopen window. */
export const SHOP_CLOSE_UTC = new Date("2026-07-08T07:27:00Z");

export const SHIP_CLOSED_MESSAGE = "Shipping closed on Jul 1 at 10:00 AM ET.";
export const SHOP_CLOSED_MESSAGE = "Shop closed on Jul 8 at 3:27 AM ET.";

export function isBeforeDeadline(deadline, now = new Date()) {
  return now.getTime() < deadline.getTime();
}

export function assertShipOpen(now = new Date()) {
  if (!isBeforeDeadline(SHIP_CLOSE_UTC, now)) {
    throw new Error(SHIP_CLOSED_MESSAGE);
  }
}

export function assertShopOpen(now = new Date()) {
  if (!isBeforeDeadline(SHOP_CLOSE_UTC, now)) {
    throw new Error(SHOP_CLOSED_MESSAGE);
  }
}
