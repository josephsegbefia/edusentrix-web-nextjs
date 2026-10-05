import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  BackgroundJob,
  backgroundJobTenantKey,
  type IBackgroundJob,
} from "@/models/BackgroundJob";
import { buildBackgroundJobRequestedEvent } from "./events";
import { inngestEventPort } from "./inngest-port";
import {
  getBackgroundJobKindPolicy,
  requireBackgroundJobKind,
  type BackgroundJobKind,
} from "./job-kinds";
import { sanitizeBackgroundErrorMessage } from "./errors";
import { assertBoundedBackgroundJobPayload } from "./payload-limits";
import { getBackgroundRetryPolicy } from "./retry-policies";
import { isDuplicateKeyError, optionalObjectId } from "./object-id";
import {
  markJobDispatchFailed,
  markJobQueuedForRedispatch,
  persistInngestEventId,
} from "./state-machine";

export type EnqueueBackgroundJobInput = {
  kind: BackgroundJobKind | string;
  schoolId?: string | Types.ObjectId | null;
  initiatedByUserId?: string | Types.ObjectId | null;
  targetUserId?: string | Types.ObjectId | null;
  subjectType?: string | null;
  subjectId?: string | Types.ObjectId | null;
  correlationId?: string | null;
  input?: Record<string, unknown>;
  idempotencyKey?: string | null;
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
  notificationTargetUserId?: string | Types.ObjectId | null;
};

export type EnqueueBackgroundJobResult = {
  jobId: string;
  job: IBackgroundJob;
  created: boolean;
  dispatched: boolean;
  inngestEventId: string | null;
};

async function dispatchJobEvent(job: IBackgroundJob): Promise<EnqueueBackgroundJobResult> {
  const event = buildBackgroundJobRequestedEvent({
    jobId: String(job._id),
    kind: job.kind,
    schoolId: job.schoolId ? String(job.schoolId) : null,
    initiatedByUserId: job.initiatedByUserId ? String(job.initiatedByUserId) : null,
    correlationId: job.correlationId,
  });

  try {
    const sent = await inngestEventPort.send(event);
    const eventId = sent.ids[0] ?? String(job._id);
    const updated = (await persistInngestEventId(job._id, eventId)) ?? job;
    return {
      jobId: String(updated._id),
      job: updated,
      created: true,
      dispatched: true,
      inngestEventId: eventId,
    };
  } catch (error) {
    const failed =
      (await markJobDispatchFailed(job._id, {
        code: "INNGEST_SEND_FAILED",
        message: sanitizeBackgroundErrorMessage(error),
      })) ?? job;
    return {
      jobId: String(failed._id),
      job: failed,
      created: true,
      dispatched: false,
      inngestEventId: failed.inngestEventId ?? null,
    };
  }
}

async function findIdempotentJob(input: {
  tenantKey: string;
  kind: BackgroundJobKind;
  idempotencyKey: string;
}): Promise<IBackgroundJob | null> {
  return BackgroundJob.findOne({
    tenantKey: input.tenantKey,
    kind: input.kind,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function enqueueBackgroundJob(
  input: EnqueueBackgroundJobInput
): Promise<EnqueueBackgroundJobResult> {
  await connectToDatabase();
  const kind = requireBackgroundJobKind(input.kind);
  const policy = getBackgroundJobKindPolicy(kind);
  const schoolId = optionalObjectId(input.schoolId);
  if (policy.schoolScoped && !schoolId) {
    throw new Error(`${kind} requires schoolId`);
  }
  if (input.input !== undefined) {
    assertBoundedBackgroundJobPayload(input.input, "input");
  }

  const retry = getBackgroundRetryPolicy(policy.retryPolicyId);
  const tenantKey = backgroundJobTenantKey(schoolId);
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  const now = new Date();

  if (idempotencyKey) {
    const existing = await findIdempotentJob({ tenantKey, kind, idempotencyKey });
    if (existing) {
      return reuseExistingJob(existing);
    }
  }

  let created: IBackgroundJob;
  try {
    created = await BackgroundJob.create({
      kind,
      version: 1,
      schoolId,
      initiatedByUserId: optionalObjectId(input.initiatedByUserId),
      targetUserId: optionalObjectId(input.targetUserId),
      platformScope: !schoolId,
      tenantKey,
      subjectType: input.subjectType ?? null,
      subjectId: optionalObjectId(input.subjectId),
      correlationId: input.correlationId ?? null,
      idempotencyKey,
      status: "queued",
      progressPercent: 0,
      queuedAt: now,
      currentAttempt: 0,
      maxAttempts: retry.maxAttempts,
      notifyOnSuccess: input.notifyOnSuccess ?? policy.notifyOnSuccessDefault,
      notifyOnFailure: input.notifyOnFailure ?? policy.notifyOnFailureDefault,
      notificationTargetUserId: optionalObjectId(input.notificationTargetUserId),
      input: input.input,
    });
  } catch (error) {
    if (idempotencyKey && isDuplicateKeyError(error)) {
      const existing = await findIdempotentJob({ tenantKey, kind, idempotencyKey });
      if (existing) return reuseExistingJob(existing);
    }
    throw error;
  }

  const dispatched = await dispatchJobEvent(created);
  return { ...dispatched, created: true };
}

async function reuseExistingJob(job: IBackgroundJob): Promise<EnqueueBackgroundJobResult> {
  if (job.status === "dispatch_failed") {
    const redispatched = await redispatchBackgroundJob(job._id);
    return { ...redispatched, created: false };
  }
  return {
    jobId: String(job._id),
    job,
    created: false,
    dispatched: Boolean(job.inngestEventId),
    inngestEventId: job.inngestEventId ?? null,
  };
}

export async function redispatchBackgroundJob(
  jobId: string | Types.ObjectId
): Promise<EnqueueBackgroundJobResult> {
  await connectToDatabase();
  const job = await BackgroundJob.findById(jobId);
  if (!job) {
    throw new Error("BackgroundJob not found");
  }

  if (job.inngestEventId && job.status !== "dispatch_failed") {
    return {
      jobId: String(job._id),
      job,
      created: false,
      dispatched: true,
      inngestEventId: job.inngestEventId,
    };
  }

  if (job.status === "dispatch_failed") {
    await markJobQueuedForRedispatch(job._id);
  } else if (job.status !== "queued") {
    return {
      jobId: String(job._id),
      job,
      created: false,
      dispatched: Boolean(job.inngestEventId),
      inngestEventId: job.inngestEventId ?? null,
    };
  }

  const fresh = (await BackgroundJob.findById(job._id)) ?? job;
  const result = await dispatchJobEvent(fresh);
  return { ...result, created: false };
}
