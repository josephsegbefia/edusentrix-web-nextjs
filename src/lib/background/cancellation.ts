import type { Types } from "mongoose";
import { BackgroundJob } from "@/models/BackgroundJob";
import { canCancelBackgroundJob, type BackgroundJobActor } from "./authorization";
import { requestJobCancellation } from "./state-machine";

export async function requestBackgroundJobCancellation(
  jobId: string | Types.ObjectId,
  actor: BackgroundJobActor
) {
  const job = await BackgroundJob.findById(jobId);
  if (!job) {
    return { ok: false as const, reason: "not_found" as const };
  }
  const access = canCancelBackgroundJob(actor, job);
  if (!access.ok) return access;
  const updated = await requestJobCancellation(job._id, actor.userId);
  return { ok: true as const, job: updated ?? job };
}

export async function isCancellationRequested(jobId: string | Types.ObjectId): Promise<boolean> {
  const job = await BackgroundJob.findById(jobId).select("status").lean<{ status?: string } | null>();
  return job?.status === "cancel_requested";
}
