/**
 * Inngest v4 concurrency for AI workers.
 * Global cap leaves room for other schools; per-school cap stops one tenant
 * from monopolizing provider quota. Same-subject Explore serialization is
 * enforced by generationKey uniqueness, not extra event fields.
 */
export const AI_INNGEST_CONCURRENCY = [
  { limit: 6 },
  { limit: 2, key: "event.data.schoolId" },
] as const;
