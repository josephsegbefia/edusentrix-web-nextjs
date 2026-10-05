import type { IBackgroundJob } from "@/models/BackgroundJob";
import type { BackgroundJobActor } from "./authorization";
import { canRetryBackgroundJob } from "./authorization";
import { getBackgroundJobKindPolicy } from "./job-kinds";
import { isTerminalBackgroundJobStatus } from "./job-status";

export type SafeBackgroundJobDTO = {
  id: string;
  kind: string;
  displayLabel: string;
  status: string;
  progressPercent: number;
  progressStage: string | null;
  progressMessage: string | null;
  createdAt: string;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  cancellable: boolean;
  cancelRequested: boolean;
  retryAllowed: boolean;
  actionUrl: string | null;
  error: { code: string; message: string } | null;
  resultRef: { subjectType: string | null; subjectId: string | null } | null;
};

function iso(value?: Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function safeBackgroundJobActionUrl(
  result?: Record<string, unknown> | null
): string | null {
  if (!result || typeof result !== "object") return null;
  const nested = result.notification;
  const fromNested =
    nested &&
    typeof nested === "object" &&
    typeof (nested as { actionUrl?: unknown }).actionUrl === "string"
      ? (nested as { actionUrl: string }).actionUrl
      : null;
  const fromRoot = typeof result.actionUrl === "string" ? result.actionUrl : null;
  const url = fromNested || fromRoot;
  if (!url || !url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}

export function toSafeBackgroundJobDTO(
  job: IBackgroundJob,
  actor?: BackgroundJobActor | null
): SafeBackgroundJobDTO {
  const policy = getBackgroundJobKindPolicy(job.kind);
  const resultRef =
    job.subjectType || job.subjectId
      ? {
          subjectType: job.subjectType ?? null,
          subjectId: job.subjectId ? String(job.subjectId) : null,
        }
      : null;

  return {
    id: String(job._id),
    kind: job.kind,
    displayLabel: policy.displayLabel,
    status: job.status,
    progressPercent: job.progressPercent,
    progressStage: job.progressStage ?? null,
    progressMessage: job.progressMessage ?? null,
    createdAt: new Date(job.createdAt).toISOString(),
    queuedAt: new Date(job.queuedAt).toISOString(),
    startedAt: iso(job.startedAt),
    completedAt: iso(job.completedAt),
    failedAt: iso(job.failedAt),
    cancelledAt: iso(job.cancelledAt),
    cancellable: policy.cancellable && !isTerminalBackgroundJobStatus(job.status),
    cancelRequested: job.status === "cancel_requested",
    retryAllowed: actor ? canRetryBackgroundJob(actor, job).ok : false,
    actionUrl: safeBackgroundJobActionUrl(job.result),
    error:
      job.lastErrorMessage || job.lastErrorCode
        ? {
            code: job.lastErrorCode ?? "FAILED",
            message: job.lastErrorMessage ?? "Background job failed",
          }
        : null,
    resultRef,
  };
}
