import "server-only";

import mongoose from "mongoose";
import { enqueueBackgroundJob, redispatchBackgroundJob } from "@/lib/background/enqueue-job";
import { isTerminalBackgroundJobStatus } from "@/lib/background/job-status";
import { BackgroundJob } from "@/models/BackgroundJob";
import {
  BulkImportJob,
  type BulkImportTargetKind,
  type IBulkImportJob,
} from "@/models/BulkImportJob";

export const BULK_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export function bulkImportActionUrl(targetKind: BulkImportTargetKind) {
  return targetKind === "teachers" ? "/admin/teachers" : "/admin/students";
}

export function serializeBulkImportJob(job: IBulkImportJob) {
  return {
    id: String(job._id),
    targetKind: job.targetKind,
    status: job.status,
    fileName: job.fileName,
    totalRows: job.totalRows,
    successfulRows: job.successfulRows,
    failedRows: job.failedRows,
    created: job.successfulRows,
    failed: job.failedRows,
    errors: job.rowErrors,
    result: job.result ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function persistAndEnqueueBulkImport(input: {
  schoolId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  targetKind: BulkImportTargetKind;
  fileName: string;
  mimeType?: string | null;
  fileBytes: Buffer;
  classGroupId?: mongoose.Types.ObjectId | null;
}): Promise<{
  job: IBulkImportJob;
  jobId: string;
  bulkImportJobId: string;
}> {
  if (input.fileBytes.length === 0) {
    throw new Error("File is empty");
  }
  if (input.fileBytes.length > BULK_IMPORT_MAX_BYTES) {
    throw new Error("File is too large. Maximum size is 5MB.");
  }

  const domain = await BulkImportJob.create({
    schoolId: input.schoolId,
    createdBy: input.createdBy,
    targetKind: input.targetKind,
    status: "pending",
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    fileBytes: input.fileBytes,
    classGroupId: input.classGroupId ?? null,
  });

  const queued = await enqueueBackgroundJob({
    kind: "BULK_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.createdBy,
    notificationTargetUserId: input.createdBy,
    subjectType: "BulkImportJob",
    subjectId: domain._id,
    idempotencyKey: `bulk-import:${String(input.schoolId)}:${String(domain._id)}`,
    input: { bulkImportJobId: String(domain._id), targetKind: input.targetKind },
  });

  domain.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await domain.save();
  return {
    job: domain,
    jobId: queued.jobId,
    bulkImportJobId: String(domain._id),
  };
}

export async function requeueBulkImport(input: {
  schoolId: mongoose.Types.ObjectId;
  bulkImportJobId: mongoose.Types.ObjectId;
  initiatedByUserId: mongoose.Types.ObjectId;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  const domain = await BulkImportJob.findOne({
    _id: input.bulkImportJobId,
    schoolId: input.schoolId,
  });
  if (!domain) throw new Error("Bulk import job not found");
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
    kind: "BULK_IMPORT",
    schoolId: input.schoolId,
    initiatedByUserId: input.initiatedByUserId,
    notificationTargetUserId: input.initiatedByUserId,
    subjectType: "BulkImportJob",
    subjectId: domain._id,
    idempotencyKey: `bulk-import:${String(input.schoolId)}:${String(domain._id)}`,
    input: { bulkImportJobId: String(domain._id), targetKind: domain.targetKind },
  });
  domain.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await domain.save();
  return { jobId: queued.jobId, created: queued.created, status: queued.job.status };
}
