/**
 * Inngest v4 concurrency for Prompt 4 operational workers.
 */
export const IMPORT_INNGEST_CONCURRENCY = [
  { limit: 4 },
  { limit: 1, key: "event.data.schoolId" },
] as const;

export const PROVISIONING_INNGEST_CONCURRENCY = [
  { limit: 2 },
  { limit: 1, key: "event.data.schoolId" },
] as const;

export const OUTBOX_INNGEST_CONCURRENCY = [
  { limit: 5 },
  { limit: 2, key: "event.data.schoolId" },
] as const;
