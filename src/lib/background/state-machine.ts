import { Types } from "mongoose";
import {
  BackgroundJob,
  type IBackgroundJob,
} from "@/models/BackgroundJob";
import { assertBoundedBackgroundJobPayload } from "./payload-limits";
import {
  canTransitionBackgroundJob,
  isTerminalBackgroundJobStatus,
  type BackgroundJobStatus,
} from "./job-status";
import type { BackgroundErrorCategory } from "./errors";

export class IllegalBackgroundJobTransitionError extends Error {
  constructor(from: BackgroundJobStatus, to: BackgroundJobStatus) {
    super(`Illegal BackgroundJob transition: ${from} -> ${to}`);
    this.name = "IllegalBackgroundJobTransitionError";
  }
}

async function transitionJob(
  jobId: Types.ObjectId | string,
  to: BackgroundJobStatus,
  from: readonly BackgroundJobStatus[],
  update: Record<string, unknown>
): Promise<IBackgroundJob | null> {
  for (const status of from) {
    if (!canTransitionBackgroundJob(status, to)) {
      throw new IllegalBackgroundJobTransitionError(status, to);
    }
  }
  return BackgroundJob.findOneAndUpdate(
    { _id: jobId, status: { $in: [...from] } },
    { $set: update },
    { new: true }
  );
}

export async function markJobDispatchFailed(
  jobId: Types.ObjectId | string,
  error: { code?: string; message: string }
): Promise<IBackgroundJob | null> {
  return transitionJob(jobId, "dispatch_failed", ["queued"], {
    status: "dispatch_failed",
    lastErrorCode: error.code ?? "DISPATCH_FAILED",
    lastErrorMessage: error.message,
    failureCategory: "RETRYABLE",
  });
}

export async function persistInngestEventId(
  jobId: Types.ObjectId | string,
  inngestEventId: string
): Promise<IBackgroundJob | null> {
  return BackgroundJob.findOneAndUpdate(
    {
      _id: jobId,
      $or: [{ inngestEventId: null }, { inngestEventId: { $exists: false } }],
    },
    { $set: { inngestEventId } },
    { new: true }
  );
}

export async function markJobRunning(
  jobId: Types.ObjectId | string,
  opts?: { inngestRunId?: string | null }
): Promise<IBackgroundJob | null> {
  const now = new Date();
  return BackgroundJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["queued", "dispatch_failed", "waiting", "running"] } },
    [
      {
        $set: {
          status: "running",
          lastHeartbeatAt: now,
          startedAt: { $ifNull: ["$startedAt", now] },
          currentAttempt: { $add: ["$currentAttempt", 1] },
          ...(opts?.inngestRunId ? { inngestRunId: opts.inngestRunId } : {}),
        },
      },
    ],
    { new: true }
  );
}

export async function updateJobProgress(
  jobId: Types.ObjectId | string,
  input: {
    progressPercent: number;
    progressStage?: string | null;
    progressMessage?: string | null;
  }
): Promise<IBackgroundJob | null> {
  const percent = Math.max(0, Math.min(100, Math.round(input.progressPercent)));
  return BackgroundJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["running", "waiting", "cancel_requested"] } },
    {
      $set: {
        progressPercent: percent,
        progressStage: input.progressStage ?? null,
        progressMessage: input.progressMessage ?? null,
        progressUpdatedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    },
    { new: true }
  );
}

export async function heartbeatJob(jobId: Types.ObjectId | string): Promise<void> {
  await BackgroundJob.updateOne(
    { _id: jobId, status: { $in: ["running", "waiting"] } },
    { $set: { lastHeartbeatAt: new Date() } }
  );
}

export async function markJobSucceeded(
  jobId: Types.ObjectId | string,
  result?: Record<string, unknown>
): Promise<IBackgroundJob | null> {
  if (result !== undefined) {
    assertBoundedBackgroundJobPayload(result, "result");
  }
  const now = new Date();
  return BackgroundJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["queued", "running", "waiting", "cancel_requested"] } },
    {
      $set: {
        status: "succeeded",
        progressPercent: 100,
        progressUpdatedAt: now,
        completedAt: now,
        lastHeartbeatAt: now,
        ...(result !== undefined ? { result } : {}),
      },
    },
    { new: true }
  );
}

export async function markJobFailed(
  jobId: Types.ObjectId | string,
  error: {
    code?: string;
    message: string;
    category?: BackgroundErrorCategory;
  }
): Promise<IBackgroundJob | null> {
  const now = new Date();
  return BackgroundJob.findOneAndUpdate(
    {
      _id: jobId,
      status: { $in: ["queued", "dispatch_failed", "running", "waiting", "cancel_requested"] },
    },
    {
      $set: {
        status: "failed",
        failedAt: now,
        completedAt: now,
        lastHeartbeatAt: now,
        lastErrorCode: error.code ?? "FAILED",
        lastErrorMessage: error.message,
        failureCategory: error.category ?? "RETRYABLE",
      },
    },
    { new: true }
  );
}

export async function requestJobCancellation(
  jobId: Types.ObjectId | string,
  actorUserId?: Types.ObjectId | string | null
): Promise<IBackgroundJob | null> {
  const now = new Date();
  return BackgroundJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["queued", "dispatch_failed", "running", "waiting"] } },
    {
      $set: {
        status: "cancel_requested",
        cancelRequestedAt: now,
        cancelRequestedByUserId: actorUserId ? new Types.ObjectId(String(actorUserId)) : null,
      },
    },
    { new: true }
  );
}

export async function markJobCancelled(
  jobId: Types.ObjectId | string
): Promise<IBackgroundJob | null> {
  const now = new Date();
  return BackgroundJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["queued", "dispatch_failed", "running", "waiting", "cancel_requested"] } },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        completedAt: now,
        lastHeartbeatAt: now,
      },
    },
    { new: true }
  );
}

export function assertNotRerunTerminal(job: IBackgroundJob): boolean {
  return isTerminalBackgroundJobStatus(job.status);
}
