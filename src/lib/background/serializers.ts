import type { IBackgroundJob } from "@/models/BackgroundJob";
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
  error: { code: string; message: string } | null;
  resultRef: { subjectType: string | null; subjectId: string | null } | null;
};

function iso(value?: Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function toSafeBackgroundJobDTO(job: IBackgroundJob): SafeBackgroundJobDTO {
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
