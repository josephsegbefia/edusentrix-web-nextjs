import { Types } from "mongoose";
import type { IBackgroundJob } from "@/models/BackgroundJob";
import { getBackgroundJobKindPolicy } from "./job-kinds";
import { isTerminalBackgroundJobStatus } from "./job-status";

export type BackgroundJobActor = {
  userId: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  isSchoolAdmin?: boolean;
  isPlatformOperator?: boolean;
};

export type BackgroundJobAccessDecision =
  | { ok: true; reason: "initiator" | "target" | "notification_target" | "school_admin" | "platform" }
  | { ok: false; reason: "not_found" | "forbidden" };

function sameId(
  left?: Types.ObjectId | string | null,
  right?: Types.ObjectId | string | null
): boolean {
  if (!left || !right) return false;
  return String(left) === String(right);
}

export function decideBackgroundJobAccess(
  actor: BackgroundJobActor,
  job: IBackgroundJob
): BackgroundJobAccessDecision {
  if (job.platformScope || !job.schoolId) {
    if (actor.isPlatformOperator) return { ok: true, reason: "platform" };
    return { ok: false, reason: "not_found" };
  }

  if (!actor.schoolId || String(actor.schoolId) !== String(job.schoolId)) {
    return { ok: false, reason: "not_found" };
  }

  if (sameId(actor.userId, job.initiatedByUserId)) {
    return { ok: true, reason: "initiator" };
  }
  if (sameId(actor.userId, job.targetUserId)) {
    return { ok: true, reason: "target" };
  }
  if (sameId(actor.userId, job.notificationTargetUserId)) {
    return { ok: true, reason: "notification_target" };
  }

  const policy = getBackgroundJobKindPolicy(job.kind);
  if (actor.isSchoolAdmin && policy.userVisible) {
    return { ok: true, reason: "school_admin" };
  }

  return { ok: false, reason: "forbidden" };
}

export function canRetryBackgroundJob(
  actor: BackgroundJobActor,
  job: IBackgroundJob
): { ok: true } | { ok: false; reason: "not_found" | "forbidden" | "not_retryable" | "not_failed" } {
  const access = decideBackgroundJobAccess(actor, job);
  if (!access.ok) return access;
  const policy = getBackgroundJobKindPolicy(job.kind);
  if (!policy.manualRetryAllowed) return { ok: false, reason: "not_retryable" };
  if (job.status !== "failed") return { ok: false, reason: "not_failed" };
  return { ok: true };
}

export function canCancelBackgroundJob(
  actor: BackgroundJobActor,
  job: IBackgroundJob
): { ok: true } | { ok: false; reason: "not_found" | "forbidden" | "not_cancellable" | "terminal" } {
  const access = decideBackgroundJobAccess(actor, job);
  if (!access.ok) return access;
  const policy = getBackgroundJobKindPolicy(job.kind);
  if (!policy.cancellable) return { ok: false, reason: "not_cancellable" };
  if (isTerminalBackgroundJobStatus(job.status)) return { ok: false, reason: "terminal" };
  return { ok: true };
}

export function assertEventTenantMatchesJob(
  job: IBackgroundJob,
  eventSchoolId?: string | null
): void {
  const jobSchoolId = job.schoolId ? String(job.schoolId) : undefined;
  const eventId = eventSchoolId || undefined;
  if (jobSchoolId !== eventId) {
    throw new Error("Background job event schoolId does not match BackgroundJob");
  }
}
