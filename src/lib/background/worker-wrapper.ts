import "server-only";

import { NonRetriableError } from "inngest";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BackgroundJob, type IBackgroundJob } from "@/models/BackgroundJob";
import { assertEventTenantMatchesJob } from "./authorization";
import {
  BackgroundJobError,
  backgroundErrorCode,
  classifyBackgroundError,
  sanitizeBackgroundErrorMessage,
} from "./errors";
import type { BackgroundJobKind } from "./job-kinds";
import { notifyBackgroundJobCompleted, notifyBackgroundJobFailed } from "./notifications";
import { isTerminalBackgroundJobStatus } from "./job-status";
import {
  markJobCancelled,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
  updateJobProgress,
} from "./state-machine";

export type TrackedJobContext = {
  job: IBackgroundJob;
  updateProgress: (input: {
    progressPercent: number;
    progressStage?: string | null;
    progressMessage?: string | null;
  }) => Promise<void>;
  isCancellationRequested: () => Promise<boolean>;
  throwIfCancellationRequested: () => Promise<void>;
};

export type TrackedJobHandler = (
  context: TrackedJobContext
) => Promise<Record<string, unknown> | void>;

export type TrackedJobRunResult =
  | { outcome: "succeeded"; job: IBackgroundJob }
  | { outcome: "skipped_terminal"; job: IBackgroundJob }
  | { outcome: "cancelled"; job: IBackgroundJob };

export async function runTrackedBackgroundJob(input: {
  jobId: string;
  expectedKind: BackgroundJobKind;
  eventSchoolId?: string | null;
  inngestRunId?: string | null;
  handler: TrackedJobHandler;
}): Promise<TrackedJobRunResult> {
  await connectToDatabase();
  const job = await BackgroundJob.findById(input.jobId);
  if (!job) {
    throw new NonRetriableError("BackgroundJob not found");
  }
  if (job.kind !== input.expectedKind) {
    throw new NonRetriableError("BackgroundJob kind mismatch");
  }
  assertEventTenantMatchesJob(job, input.eventSchoolId);

  if (isTerminalBackgroundJobStatus(job.status)) {
    return { outcome: "skipped_terminal", job };
  }

  if (job.status === "cancel_requested") {
    const cancelled = (await markJobCancelled(job._id)) ?? job;
    return { outcome: "cancelled", job: cancelled };
  }

  const running = (await markJobRunning(job._id, { inngestRunId: input.inngestRunId })) ?? job;

  const isCancellationRequested = async () => {
    const fresh = await BackgroundJob.findById(job._id).select("status").lean<{ status?: string } | null>();
    return fresh?.status === "cancel_requested";
  };

  const throwIfCancellationRequested = async () => {
    if (await isCancellationRequested()) {
      throw new BackgroundJobError({
        message: "Background job cancelled",
        category: "CANCELLED",
        code: "CANCELLED",
      });
    }
  };

  try {
    await throwIfCancellationRequested();
    const result = await input.handler({
      job: running,
      updateProgress: async (progress) => {
        await updateJobProgress(job._id, progress);
      },
      isCancellationRequested,
      throwIfCancellationRequested,
    });
    if (await isCancellationRequested()) {
      const cancelled = (await markJobCancelled(job._id)) ?? running;
      return { outcome: "cancelled", job: cancelled };
    }
    const succeeded =
      (await markJobSucceeded(
        job._id,
        result && typeof result === "object" ? result : { ok: true }
      )) ?? running;
    await notifyBackgroundJobCompleted(succeeded);
    return { outcome: "succeeded", job: succeeded };
  } catch (error) {
    const category = classifyBackgroundError(error);
    if (category === "CANCELLED") {
      const cancelled = (await markJobCancelled(job._id)) ?? running;
      return { outcome: "cancelled", job: cancelled };
    }
    if (category === "PERMANENT" || category === "PREREQUISITE_FAILED") {
      await finalizeFailedBackgroundJob(job._id, error);
      throw new NonRetriableError(sanitizeBackgroundErrorMessage(error));
    }
    throw error;
  }
}

export async function finalizeFailedBackgroundJob(
  jobId: string | Types.ObjectId,
  error: unknown
): Promise<IBackgroundJob | null> {
  const failed = await markJobFailed(jobId, {
    code: backgroundErrorCode(error),
    message: sanitizeBackgroundErrorMessage(error),
    category: classifyBackgroundError(error),
  });
  if (failed) {
    await notifyBackgroundJobFailed(failed);
  }
  return failed;
}
