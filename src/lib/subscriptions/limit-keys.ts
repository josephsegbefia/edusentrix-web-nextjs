/**
 * Canonical subscription limit key registry.
 *
 * RULES:
 * - Limits must be defined here. Never use raw string literals.
 * - null = no limit (only for explicitly unlimited scenarios, never for missing data).
 * - 0 = feature not included / blocked.
 * - Positive number = the numeric cap.
 */

export const LIMIT_KEYS = {
  /** Maximum active students for this school. */
  maxStudents: "maxStudents",
  /** Maximum active teachers/staff. */
  maxTeachers: "maxTeachers",
  /** Maximum invitations sent per calendar month. */
  maxInvitationsPerMonth: "maxInvitationsPerMonth",
  /** Maximum storage in bytes. */
  maxStorageBytes: "maxStorageBytes",
  /** Leo AI credits available per academic term. */
  leoCreditsPerTerm: "leoCreditsPerTerm",
  /** Meeting participant-minutes available per academic term. */
  meetingParticipantMinutesPerTerm: "meetingParticipantMinutesPerTerm",
  /** Active Learn student seats. */
  learnSeats: "learnSeats",
  /** Data/report exports per calendar month. */
  reportExportsPerTerm: "reportExportsPerTerm",
  /** AI-generated exam sets per academic term. */
  examGenerationsPerTerm: "examGenerationsPerTerm",
} as const;

export type LimitKey = (typeof LIMIT_KEYS)[keyof typeof LIMIT_KEYS];

const KNOWN_LIMIT_KEYS = new Set<string>(Object.values(LIMIT_KEYS));

export function isKnownLimitKey(key: string): key is LimitKey {
  return KNOWN_LIMIT_KEYS.has(key);
}

export type PlanLimits = Record<LimitKey, number | null>;

/** Safe constant for 1 GB in bytes. */
export const ONE_GB = 1_073_741_824;

/**
 * Default numeric plan limits (v1).
 * Pilot values are "must be set explicitly" — defaults to 0 / blocked.
 */
export const DEFAULT_PLAN_LIMITS: Record<"pilot" | "starter" | "growth" | "premium", PlanLimits> = {
  pilot: {
    maxStudents: 0,              // must be set per pilot school
    maxTeachers: 0,
    maxInvitationsPerMonth: 0,
    maxStorageBytes: 0,
    leoCreditsPerTerm: 0,
    meetingParticipantMinutesPerTerm: 0,
    learnSeats: 0,
    reportExportsPerTerm: 0,
    examGenerationsPerTerm: 0,
  },
  starter: {
    maxStudents: 500,
    maxTeachers: 40,
    maxInvitationsPerMonth: 100,
    maxStorageBytes: 5 * ONE_GB,
    leoCreditsPerTerm: 0,                       // Leo not included in Starter
    meetingParticipantMinutesPerTerm: 0,         // meetings not included
    learnSeats: 0,                               // Learn is add-on only
    reportExportsPerTerm: 5,
    examGenerationsPerTerm: 0,
  },
  growth: {
    maxStudents: 1500,
    maxTeachers: 120,
    maxInvitationsPerMonth: 300,
    maxStorageBytes: 25 * ONE_GB,
    leoCreditsPerTerm: 500,
    meetingParticipantMinutesPerTerm: 0,         // add-on only
    learnSeats: 0,                               // add-on only
    reportExportsPerTerm: 20,
    examGenerationsPerTerm: 30,
  },
  premium: {
    maxStudents: null,           // negotiated / unlimited
    maxTeachers: null,
    maxInvitationsPerMonth: null,
    maxStorageBytes: 100 * ONE_GB,
    leoCreditsPerTerm: 2500,
    meetingParticipantMinutesPerTerm: 1000,      // included
    learnSeats: 0,                               // add-on or negotiated
    reportExportsPerTerm: 100,
    examGenerationsPerTerm: 200,
  },
};
