export const BACKGROUND_JOB_STATUSES = [
  "queued",
  "dispatch_failed",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancel_requested",
  "cancelled",
] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export const TERMINAL_BACKGROUND_JOB_STATUSES: readonly BackgroundJobStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
];

export const ACTIVE_BACKGROUND_JOB_STATUSES: readonly BackgroundJobStatus[] = [
  "queued",
  "dispatch_failed",
  "running",
  "waiting",
  "cancel_requested",
];

export const LEGAL_BACKGROUND_JOB_TRANSITIONS: Record<
  BackgroundJobStatus,
  readonly BackgroundJobStatus[]
> = {
  queued: ["running", "dispatch_failed", "cancel_requested", "cancelled"],
  dispatch_failed: ["queued", "cancel_requested", "cancelled"],
  running: ["waiting", "succeeded", "failed", "cancel_requested", "cancelled"],
  waiting: ["running", "cancel_requested", "cancelled", "failed"],
  succeeded: [],
  failed: [],
  cancel_requested: ["cancelled", "succeeded", "failed"],
  cancelled: [],
};

export function isBackgroundJobStatus(value: string): value is BackgroundJobStatus {
  return (BACKGROUND_JOB_STATUSES as readonly string[]).includes(value);
}

export function isTerminalBackgroundJobStatus(status: BackgroundJobStatus): boolean {
  return (TERMINAL_BACKGROUND_JOB_STATUSES as readonly string[]).includes(status);
}

export function canTransitionBackgroundJob(
  from: BackgroundJobStatus,
  to: BackgroundJobStatus
): boolean {
  return LEGAL_BACKGROUND_JOB_TRANSITIONS[from].includes(to);
}
