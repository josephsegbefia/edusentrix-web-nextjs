import { Types } from "mongoose";
import { Notification } from "@/models/Notification";
import type { IBackgroundJob } from "@/models/BackgroundJob";
import { getBackgroundJobKindPolicy } from "./job-kinds";

export type BackgroundJobNotificationResult = {
  created: boolean;
  skipped: boolean;
  reason?:
    | "not_user_visible"
    | "notify_disabled"
    | "missing_school"
    | "missing_target"
    | "duplicate";
};

function notificationTarget(job: IBackgroundJob): Types.ObjectId | null {
  return job.notificationTargetUserId ?? job.initiatedByUserId ?? job.targetUserId ?? null;
}

async function createJobNotification(input: {
  job: IBackgroundJob;
  outcome: "succeeded" | "failed";
  enabled: boolean;
}): Promise<BackgroundJobNotificationResult> {
  const policy = getBackgroundJobKindPolicy(input.job.kind);
  if (!policy.userVisible) {
    return { created: false, skipped: true, reason: "not_user_visible" };
  }
  if (!input.enabled) {
    return { created: false, skipped: true, reason: "notify_disabled" };
  }
  if (!input.job.schoolId) {
    return { created: false, skipped: true, reason: "missing_school" };
  }
  const userId = notificationTarget(input.job);
  if (!userId) {
    return { created: false, skipped: true, reason: "missing_target" };
  }

  const dedupeKey = `background-job:${String(input.job._id)}:${input.outcome}`;
  const existing = await Notification.findOne({
    schoolId: input.job.schoolId,
    userId,
    "metadata.dedupeKey": dedupeKey,
  })
    .select("_id")
    .lean();
  if (existing) {
    return { created: false, skipped: true, reason: "duplicate" };
  }

  const title =
    input.outcome === "succeeded"
      ? `${policy.displayLabel} completed`
      : `${policy.displayLabel} failed`;
  const body =
    input.outcome === "succeeded"
      ? `${policy.displayLabel} finished successfully.`
      : input.job.lastErrorMessage || `${policy.displayLabel} could not be completed.`;

  await Notification.create({
    schoolId: input.job.schoolId,
    userId,
    type: "system",
    title,
    body,
    isRead: false,
    priority: input.outcome === "failed" ? "high" : "normal",
    entityType: "BackgroundJob",
    entityId: input.job._id,
    actionUrl: undefined,
    metadata: {
      dedupeKey,
      jobId: String(input.job._id),
      kind: input.job.kind,
      outcome: input.outcome,
    },
  });

  return { created: true, skipped: false };
}

export async function notifyBackgroundJobCompleted(
  job: IBackgroundJob
): Promise<BackgroundJobNotificationResult> {
  return createJobNotification({
    job,
    outcome: "succeeded",
    enabled: job.notifyOnSuccess,
  });
}

export async function notifyBackgroundJobFailed(
  job: IBackgroundJob
): Promise<BackgroundJobNotificationResult> {
  return createJobNotification({
    job,
    outcome: "failed",
    enabled: job.notifyOnFailure,
  });
}
