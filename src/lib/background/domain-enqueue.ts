import mongoose, { Types, type HydratedDocument } from "mongoose";
import {
  enqueueBackgroundJob,
  redispatchBackgroundJob,
} from "./enqueue-job-core";
import { isTerminalBackgroundJobStatus } from "./job-status";
import { BackgroundJob } from "@/models/BackgroundJob";
import { LibraryImportJob } from "@/models/LibraryImportJob";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import { CommunicationOutboxJob } from "@/models/CommunicationOutboxJob";
import {
  ExploreGenerationJob,
  type IExploreGenerationJob,
} from "@/models/ExploreGenerationJob";
import { type IProvisioningJob } from "@/models/ProvisioningJob";

export async function enqueueLibraryImportBackgroundJob(input: {
  schoolId: Types.ObjectId;
  libraryImportJobId: Types.ObjectId;
  initiatedByUserId: Types.ObjectId;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const domain = await LibraryImportJob.findOne({
    _id: input.libraryImportJobId,
    schoolId: input.schoolId,
  });
  if (!domain) {
    throw new Error("Library import job not found");
  }
  if (domain.backgroundJobId) {
    const existing = await BackgroundJob.findById(domain.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false, status: redispatched.job.status };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false, status: existing.status };
    }
  }

  const queued = await enqueueBackgroundJob({
    kind: "LIBRARY_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.initiatedByUserId,
    notificationTargetUserId: input.initiatedByUserId,
    subjectType: "LibraryImportJob",
    subjectId: input.libraryImportJobId,
    idempotencyKey: `library-import:${String(input.schoolId)}:${String(input.libraryImportJobId)}`,
    input: { libraryImportJobId: String(input.libraryImportJobId) },
  });

  domain.backgroundJobId = new Types.ObjectId(queued.jobId);
  await domain.save();
  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}

export async function requeueSchemeImportParse(input: {
  schoolId: mongoose.Types.ObjectId;
  schemeImportJobId: mongoose.Types.ObjectId;
  initiatedByUserId: mongoose.Types.ObjectId;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const domain = await SchemeImportJob.findOne({
    _id: input.schemeImportJobId,
    schoolId: input.schoolId,
  });
  if (!domain) {
    throw new Error("Scheme import job not found");
  }
  if (domain.backgroundJobId) {
    const existing = await BackgroundJob.findById(domain.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false, status: redispatched.job.status };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false, status: existing.status };
    }
  }

  const queued = await enqueueBackgroundJob({
    kind: "SCHEME_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.initiatedByUserId,
    notificationTargetUserId: input.initiatedByUserId,
    subjectType: "SchemeImportJob",
    subjectId: domain._id,
    idempotencyKey: `scheme-import:${String(input.schoolId)}:${String(domain._id)}`,
    input: { schemeImportJobId: String(domain._id) },
  });
  domain.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  if (domain.status === "failed") {
    domain.status = "queued";
    domain.parseError = null;
  }
  await domain.save();
  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}

export async function enqueueSchoolProvisioningBackgroundJob(input: {
  schoolId: mongoose.Types.ObjectId;
  domain: HydratedDocument<IProvisioningJob>;
  initiatedByUserId?: mongoose.Types.ObjectId | string | null;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const initiatedByUserId = input.initiatedByUserId
    ? new mongoose.Types.ObjectId(String(input.initiatedByUserId))
    : null;

  if (input.domain.backgroundJobId) {
    const existing = await BackgroundJob.findById(input.domain.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false, status: redispatched.job.status };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false, status: existing.status };
    }
  }

  const payload =
    input.domain.payload && typeof input.domain.payload === "object" ? input.domain.payload : {};
  const revision = Number(payload.backgroundRevision ?? 1);

  const queued = await enqueueBackgroundJob({
    kind: "SCHOOL_PROVISIONING",
    schoolId: input.schoolId,
    initiatedByUserId,
    notificationTargetUserId: initiatedByUserId,
    subjectType: "ProvisioningJob",
    subjectId: input.domain._id,
    idempotencyKey: `provisioning:${String(input.schoolId)}:paystack_subaccount:${revision}`,
    input: { provisioningJobId: String(input.domain._id) },
  });

  input.domain.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await input.domain.save();
  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}

export async function enqueueOneCommunicationOutboxJob(input: {
  schoolId: Types.ObjectId;
  outboxJob: {
    _id: Types.ObjectId;
    deliveryId: Types.ObjectId;
    backgroundJobId?: Types.ObjectId | null;
  };
  initiatedByUserId?: Types.ObjectId | null;
}): Promise<{ jobId: string; created: boolean }> {
  if (input.outboxJob.backgroundJobId) {
    const existing = await BackgroundJob.findById(input.outboxJob.backgroundJobId);
    if (existing && existing.status === "dispatch_failed") {
      const redispatched = await redispatchBackgroundJob(existing._id);
      return { jobId: redispatched.jobId, created: false };
    }
    if (existing && !isTerminalBackgroundJobStatus(existing.status)) {
      return { jobId: String(existing._id), created: false };
    }
  }

  const queued = await enqueueBackgroundJob({
    kind: "COMMUNICATION_OUTBOX",
    schoolId: input.schoolId,
    initiatedByUserId: input.initiatedByUserId,
    subjectType: "CommunicationOutboxJob",
    subjectId: input.outboxJob._id,
    notifyOnSuccess: false,
    notifyOnFailure: false,
    idempotencyKey: `comm-outbox:${String(input.outboxJob.deliveryId)}`,
    input: {
      communicationOutboxJobId: String(input.outboxJob._id),
      deliveryId: String(input.outboxJob.deliveryId),
    },
  });

  await CommunicationOutboxJob.updateOne(
    { _id: input.outboxJob._id },
    { $set: { backgroundJobId: new Types.ObjectId(queued.jobId) } }
  );
  return { jobId: queued.jobId, created: queued.created };
}

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
