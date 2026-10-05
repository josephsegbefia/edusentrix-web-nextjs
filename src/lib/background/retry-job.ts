import "server-only";

import mongoose from "mongoose";
import { BackgroundJob, type IBackgroundJob } from "@/models/BackgroundJob";
import { BulkImportJob } from "@/models/BulkImportJob";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { LessonAiGenerationRequest } from "@/models/LessonAiGenerationRequest";
import { LessonIllustrationRequest } from "@/models/LessonIllustrationRequest";
import { LibraryImportJob } from "@/models/LibraryImportJob";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import { enqueueEmailMessageForRetry } from "@/lib/email/enqueue-dispatch-job";
import type { BackgroundJobActor } from "./authorization";
import { canRetryBackgroundJob, decideBackgroundJobAccess } from "./authorization";
import { writeBackgroundJobAudit } from "./audit";
import { enqueueBackgroundJob, type EnqueueBackgroundJobResult } from "./enqueue-job";
import { getBackgroundJobKindPolicy } from "./job-kinds";

export type RetryBackgroundJobResult =
  | { ok: true; created: EnqueueBackgroundJobResult; source: IBackgroundJob }
  | {
      ok: false;
      reason:
        | "not_found"
        | "forbidden"
        | "not_retryable"
        | "not_failed"
        | "domain_missing"
        | "domain_not_retryable";
    };

async function prepareDomainForRetry(job: IBackgroundJob): Promise<
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; reason: "domain_missing" | "domain_not_retryable" }
> {
  const schoolId = job.schoolId;
  const subjectId = job.subjectId;
  if (!schoolId || !subjectId) {
    return { ok: false, reason: "domain_missing" };
  }

  if (job.kind === "LIBRARY_IMPORT") {
    const domain = await LibraryImportJob.findOne({ _id: subjectId, schoolId });
    if (!domain) return { ok: false, reason: "domain_missing" };
    if (!domain.csvText) return { ok: false, reason: "domain_not_retryable" };
    domain.status = "pending";
    await domain.save();
    return { ok: true, input: { libraryImportJobId: String(domain._id) } };
  }

  if (job.kind === "SCHEME_IMPORT") {
    const domain = await SchemeImportJob.findOne({ _id: subjectId, schoolId });
    if (!domain) return { ok: false, reason: "domain_missing" };
    if (domain.status === "confirmed") return { ok: false, reason: "domain_not_retryable" };
    domain.status = "queued";
    domain.parseError = null;
    await domain.save();
    return { ok: true, input: { schemeImportJobId: String(domain._id) } };
  }

  if (job.kind === "BULK_IMPORT") {
    const domain = await BulkImportJob.findOne({ _id: subjectId, schoolId });
    if (!domain) return { ok: false, reason: "domain_missing" };
    if (!domain.fileBytes) return { ok: false, reason: "domain_not_retryable" };
    domain.status = "pending";
    await domain.save();
    return { ok: true, input: { bulkImportJobId: String(domain._id), targetKind: domain.targetKind } };
  }

  if (job.kind === "AI_LESSON_GENERATION") {
    const domain = await LessonAiGenerationRequest.findOne({ _id: subjectId, schoolId });
    if (!domain) return { ok: false, reason: "domain_missing" };
    domain.status = "queued";
    await domain.save();
    return { ok: true, input: { generationRequestId: String(domain._id) } };
  }

  if (job.kind === "AI_LESSON_ILLUSTRATION") {
    const domain = await LessonIllustrationRequest.findOne({ _id: subjectId, schoolId });
    if (!domain) return { ok: false, reason: "domain_missing" };
    domain.status = "queued";
    await domain.save();
    return { ok: true, input: { illustrationRequestId: String(domain._id) } };
  }

  if (job.kind === "EXPLORE_GENERATION") {
    const domain = await ExploreGenerationJob.findOne({ _id: subjectId, schoolId });
    if (!domain) return { ok: false, reason: "domain_missing" };
    domain.status = "pending";
    await domain.save();
    return {
      ok: true,
      input: {
        exploreGenerationJobId: String(domain._id),
        trigger: "teacher",
      },
    };
  }

  return { ok: false, reason: "domain_not_retryable" };
}

export async function retryBackgroundJob(input: {
  sourceJobId: string | mongoose.Types.ObjectId;
  actor: BackgroundJobActor;
  operatorEmailRetry?: boolean;
}): Promise<RetryBackgroundJobResult> {
  const source = await BackgroundJob.findById(input.sourceJobId);
  if (!source) return { ok: false, reason: "not_found" };

  if (input.operatorEmailRetry && source.kind === "EMAIL_DISPATCH" && input.actor.isPlatformOperator) {
    if (source.status !== "failed") return { ok: false, reason: "not_failed" };
    const emailMessageId =
      source.input && typeof source.input.emailMessageId === "string"
        ? source.input.emailMessageId
        : null;
    if (!emailMessageId) return { ok: false, reason: "domain_missing" };
    const queued = await enqueueEmailMessageForRetry(emailMessageId);
    if (!queued.jobId) return { ok: false, reason: "domain_not_retryable" };
    const created = await BackgroundJob.findById(queued.jobId);
    if (!created) return { ok: false, reason: "domain_missing" };
    await writeBackgroundJobAudit({
      actionCode: "background.job.retried",
      actor: input.actor,
      job: created,
      extra: { sourceJobId: String(source._id) },
    });
    return {
      ok: true,
      source,
      created: {
        jobId: queued.jobId,
        job: created,
        created: !queued.reused,
        dispatched: Boolean(created.inngestEventId),
        inngestEventId: created.inngestEventId ?? null,
      },
    };
  }

  const access = canRetryBackgroundJob(input.actor, source);
  if (!access.ok) {
    if (access.reason === "not_found") {
      const hidden = decideBackgroundJobAccess(input.actor, source);
      return { ok: false, reason: hidden.ok ? "not_retryable" : hidden.reason };
    }
    return { ok: false, reason: access.reason };
  }

  const policy = getBackgroundJobKindPolicy(source.kind);
  const prepared = await prepareDomainForRetry(source);
  if (!prepared.ok) return prepared;

  const created = await enqueueBackgroundJob({
    kind: source.kind,
    schoolId: source.schoolId,
    initiatedByUserId: input.actor.userId,
    targetUserId: source.targetUserId,
    notificationTargetUserId: source.notificationTargetUserId ?? input.actor.userId,
    subjectType: source.subjectType,
    subjectId: source.subjectId,
    correlationId: source.correlationId,
    notifyOnSuccess: policy.notifyOnSuccessDefault,
    notifyOnFailure: policy.notifyOnFailureDefault,
    retryOfJobId: source._id,
    idempotencyKey: `${source.kind.toLowerCase()}:retry:${String(source._id)}`,
    input: prepared.input,
  });

  if (source.subjectId && source.subjectType) {
    await applyDomainBackgroundJobId(source, created.jobId);
  }

  await writeBackgroundJobAudit({
    actionCode: "background.job.retried",
    actor: input.actor,
    job: created.job,
    extra: { sourceJobId: String(source._id) },
  });

  return { ok: true, created, source };
}

async function applyDomainBackgroundJobId(source: IBackgroundJob, jobId: string) {
  const id = new mongoose.Types.ObjectId(jobId);
  const filter = { _id: source.subjectId, schoolId: source.schoolId };
  if (source.kind === "LIBRARY_IMPORT") {
    await LibraryImportJob.updateOne(filter, { $set: { backgroundJobId: id } });
  } else if (source.kind === "SCHEME_IMPORT") {
    await SchemeImportJob.updateOne(filter, { $set: { backgroundJobId: id } });
  } else if (source.kind === "BULK_IMPORT") {
    await BulkImportJob.updateOne(filter, { $set: { backgroundJobId: id } });
  } else if (source.kind === "AI_LESSON_GENERATION") {
    await LessonAiGenerationRequest.updateOne(filter, { $set: { backgroundJobId: id } });
  } else if (source.kind === "AI_LESSON_ILLUSTRATION") {
    await LessonIllustrationRequest.updateOne(filter, { $set: { backgroundJobId: id } });
  } else if (source.kind === "EXPLORE_GENERATION") {
    await ExploreGenerationJob.updateOne(filter, { $set: { backgroundJobId: id } });
  }
}
