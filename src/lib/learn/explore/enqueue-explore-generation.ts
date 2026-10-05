import "server-only";

import { Types } from "mongoose";
import { enqueueBackgroundJob, redispatchBackgroundJob } from "@/lib/background/enqueue-job";
import { BackgroundJob } from "@/models/BackgroundJob";
import { ExploreGenerationJob, type IExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { isTerminalBackgroundJobStatus } from "@/lib/background/job-status";

export type ExploreGenerationTrigger = "student" | "teacher" | "admin" | "system";

export function exploreGenerationIdempotencyKey(
  generationKey: string,
  retrySuffix?: number | string
) {
  return retrySuffix == null
    ? `explore-generation:${generationKey}`
    : `explore-generation:${generationKey}:retry:${retrySuffix}`;
}

export async function enqueueExploreGenerationWork(input: {
  exploreJob: IExploreGenerationJob;
  trigger: ExploreGenerationTrigger;
  initiatedByUserId?: Types.ObjectId | string | null;
  sessionId?: Types.ObjectId | string | null;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const notify = input.trigger === "teacher" || input.trigger === "admin";
  const existingId = input.exploreJob.backgroundJobId;
  if (existingId) {
    const existing = await BackgroundJob.findById(existingId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return {
        jobId: redispatched.jobId,
        created: false,
        status: redispatched.job.status,
      };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false, status: existing.status };
    }
  }

  const retrySuffix =
    existingId && input.exploreJob.attempts > 0 ? input.exploreJob.attempts : undefined;
  const queued = await enqueueBackgroundJob({
    kind: "EXPLORE_GENERATION",
    schoolId: input.exploreJob.schoolId,
    initiatedByUserId: input.initiatedByUserId ?? null,
    notificationTargetUserId: notify ? input.initiatedByUserId ?? null : null,
    notifyOnSuccess: notify,
    notifyOnFailure: notify,
    subjectType: "ExploreGenerationJob",
    subjectId: input.exploreJob._id,
    correlationId: input.exploreJob.generationKey,
    idempotencyKey: exploreGenerationIdempotencyKey(
      input.exploreJob.generationKey,
      retrySuffix
    ),
    input: {
      exploreGenerationJobId: String(input.exploreJob._id),
      trigger: input.trigger,
      sessionId: input.sessionId ? String(input.sessionId) : null,
    },
  });

  await ExploreGenerationJob.updateOne(
    { _id: input.exploreJob._id },
    { $set: { backgroundJobId: new Types.ObjectId(queued.jobId) } }
  );

  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}
