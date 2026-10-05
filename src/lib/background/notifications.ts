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

export function resolveBackgroundJobNotificationCopy(
  job: IBackgroundJob,
  outcome: "succeeded" | "failed"
): { title: string; body: string; actionUrl?: string } {
  const policy = getBackgroundJobKindPolicy(job.kind);
  const result = job.result && typeof job.result === "object" ? job.result : {};
  const notification =
    result.notification && typeof result.notification === "object"
      ? (result.notification as Record<string, unknown>)
      : {};
  const actionUrl =
    typeof notification.actionUrl === "string"
      ? notification.actionUrl
      : typeof result.actionUrl === "string"
        ? result.actionUrl
        : undefined;

  if (outcome === "succeeded") {
    return {
      title:
        typeof notification.title === "string"
          ? notification.title
          : defaultSuccessTitle(job.kind, policy.displayLabel),
      body:
        typeof notification.body === "string"
          ? notification.body
          : defaultSuccessBody(job.kind, policy.displayLabel),
      actionUrl,
    };
  }

  return {
    title:
      typeof notification.failureTitle === "string"
        ? notification.failureTitle
        : `${policy.displayLabel} failed`,
    body:
      typeof notification.failureBody === "string"
        ? notification.failureBody
        : job.lastErrorMessage || `${policy.displayLabel} could not be completed. You can retry.`,
    actionUrl,
  };
}

function defaultSuccessTitle(kind: string, fallback: string): string {
  if (kind === "AI_LESSON_GENERATION") return "Lesson draft ready to review";
  if (kind === "EXPLORE_GENERATION") return "Explore generation complete";
  if (kind === "AI_LESSON_ILLUSTRATION") return "Illustration draft ready";
  if (kind === "LIBRARY_IMPORT") return "Library import completed";
  if (kind === "SCHEME_IMPORT") return "Scheme import ready";
  if (kind === "SCHOOL_PROVISIONING") return "Payment provisioning completed";
  if (kind === "BULK_IMPORT") return "Bulk import complete";
  return `${fallback} completed`;
}

function defaultSuccessBody(kind: string, fallback: string): string {
  if (kind === "AI_LESSON_GENERATION") return "Your lesson draft is ready to review.";
  if (kind === "EXPLORE_GENERATION") return "Explore content generation is complete.";
  if (kind === "AI_LESSON_ILLUSTRATION") return "Your illustration draft is ready to review.";
  if (kind === "LIBRARY_IMPORT") return "Library import complete.";
  if (kind === "SCHEME_IMPORT") return "Scheme import is ready for review.";
  if (kind === "SCHOOL_PROVISIONING") return "School payment provisioning completed.";
  if (kind === "BULK_IMPORT") return "Bulk import complete.";
  return `${fallback} finished successfully.`;
}

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

  const copy = resolveBackgroundJobNotificationCopy(input.job, input.outcome);
  const title = copy.title;
  const body = copy.body;

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
    actionUrl: copy.actionUrl,
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
