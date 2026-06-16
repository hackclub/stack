/** Jul 1, 2026 10:00 AM Eastern (EDT, UTC-4). */
export const SHIP_CLOSE_UTC = new Date("2026-07-01T14:00:00Z");

/** Jul 2, 2026 10:00 AM Eastern (EDT, UTC-4). */
export const SHOP_CLOSE_UTC = new Date("2026-07-02T14:00:00Z");

export const SHIP_CLOSED_MESSAGE = "Shipping closed on Jul 1 at 10:00 AM ET.";
export const SHOP_CLOSED_MESSAGE = "Shop closed on Jul 2 at 10:00 AM ET.";

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
