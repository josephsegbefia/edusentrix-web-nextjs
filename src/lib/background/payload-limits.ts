export const BACKGROUND_JOB_PAYLOAD_MAX_BYTES = 16 * 1024;

export function measureBackgroundJobPayload(value: unknown): number {
  if (value === undefined) return 0;
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function assertBoundedBackgroundJobPayload(
  value: unknown,
  field: "input" | "result"
): void {
  const bytes = measureBackgroundJobPayload(value);
  if (bytes > BACKGROUND_JOB_PAYLOAD_MAX_BYTES) {
    throw new Error(
      `BackgroundJob.${field} exceeds ${BACKGROUND_JOB_PAYLOAD_MAX_BYTES} bytes (${bytes}). Store a Mongo/R2 reference instead.`
    );
  }
}
