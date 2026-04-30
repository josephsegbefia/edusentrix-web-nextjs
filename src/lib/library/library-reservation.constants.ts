/** Days until a pending hold lapses if still not fulfilled. */
export const RESERVATION_PENDING_EXPIRE_DAYS = 30;

/** Days after a copy is marked ready for pickup before the hold lapses. */
export const RESERVATION_READY_EXPIRE_DAYS = 7;

export function reservationExpiresAtForPending(reservedAt: Date): Date {
  const d = new Date(reservedAt.getTime());
  d.setUTCDate(d.getUTCDate() + RESERVATION_PENDING_EXPIRE_DAYS);
  return d;
}

export function reservationExpiresAtForReady(readyAt: Date): Date {
  const d = new Date(readyAt.getTime());
  d.setUTCDate(d.getUTCDate() + RESERVATION_READY_EXPIRE_DAYS);
  return d;
}

/** Reserved-at must be <= this cutoff for a legacy pending hold (no `expiresAt`) to be stale. */
export function stalePendingReservedAtCutoff(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - RESERVATION_PENDING_EXPIRE_DAYS);
  return d;
}

/** Ready-at must be <= this cutoff for a legacy ready hold (no `expiresAt`) to be stale. */
export function staleReadyReadyAtCutoff(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - RESERVATION_READY_EXPIRE_DAYS);
  return d;
}
