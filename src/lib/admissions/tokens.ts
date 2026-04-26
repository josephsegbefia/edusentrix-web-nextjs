// src/lib/admissions/tokens.ts
// Token + reference-code helpers for the Admissions feature.

import crypto from "crypto";

const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Tracker token used in `/apply/track/<token>` resume links. 32 hex chars
 * gives ~128 bits of entropy — practically unguessable without leakage.
 */
export function generateTrackerToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Short, human-readable reference code shown to applicants and used for support
 * conversations. We retry on collision per (schoolId, code) at the call site.
 */
export function generateReferenceCode(prefix = "APP"): string {
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    const idx = crypto.randomInt(0, REFERENCE_ALPHABET.length);
    suffix += REFERENCE_ALPHABET[idx];
  }
  return `${prefix}-${suffix}`;
}

/**
 * Short invite/share code used by AdmissionInviteLink and `?ref=` UTM-style
 * tagging on the public form.
 */
export function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}
