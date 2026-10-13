import "server-only";

import mongoose from "mongoose";
import {
  BulkImportJob,
  type BulkImportTargetKind,
  type IBulkImportJob,
} from "@/models/BulkImportJob";
import {
  LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE,
  quarantineLegacyBulkImport,
} from "@/lib/imports/legacy-bulk-import-quarantine";

/** Retained only for historical-record serializers and route compatibility. */
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

/**
 * New imports must use TeacherImportJob or StudentImportJob. Keeping this
 * export fails closed for callers that have not yet been migrated.
 */
export async function persistAndEnqueueBulkImport(_input: {
  schoolId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  targetKind: BulkImportTargetKind;
  fileName: string;
  mimeType?: string | null;
  fileBytes: Buffer;
  classGroupId?: mongoose.Types.ObjectId | null;
}): Promise<never> {
  throw new Error(
    "Legacy BulkImportJob creation is disabled. Use the staged teacher or student import workflow."
  );
}

/**
 * Legacy jobs cannot be retried: the old executors bypass review. This keeps
 * the function callable by old recovery code while quarantining its target.
 */
export async function requeueBulkImport(input: {
  schoolId: mongoose.Types.ObjectId;
  bulkImportJobId: mongoose.Types.ObjectId;
  initiatedByUserId: mongoose.Types.ObjectId;
}): Promise<{ jobId: string; created: boolean; status: string }> {
  void input.initiatedByUserId;
  const domain = await BulkImportJob.findOne({
    _id: input.bulkImportJobId,
    schoolId: input.schoolId,
  });
  if (!domain) throw new Error("Bulk import job not found");

  const quarantined = await quarantineLegacyBulkImport({
    bulkImportJobId: domain._id,
    schoolId: input.schoolId,
  });
  if (!quarantined && domain.status !== "superseded") {
    throw new Error(LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE);
  }
  return {
    jobId: domain.backgroundJobId ? String(domain.backgroundJobId) : String(domain._id),
    created: false,
    status: "superseded",
  };
}
