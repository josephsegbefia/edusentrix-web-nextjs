import "server-only";

import mongoose from "mongoose";
import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { bulkImportActionUrl } from "@/lib/imports/enqueue-bulk-import";
import { parseStudentImportFile } from "@/lib/students/student-import-parse";
import {
  importStudentsFromRows,
  resolveFixedClassTarget,
} from "@/lib/students/student-import-service";
import { importTeachersFromBuffer } from "@/lib/teachers/execute-teacher-bulk-import";
import { BulkImportJob, type IBulkImportJob } from "@/models/BulkImportJob";
import type { HydratedDocument } from "mongoose";

type BulkImportDoc = HydratedDocument<IBulkImportJob>;

function notificationFor(job: IBulkImportJob) {
  return {
    title: "Bulk import complete",
    body: "Bulk import complete.",
    actionUrl: bulkImportActionUrl(job.targetKind),
  };
}

export async function executeBulkImport(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const bulkImportJobId =
    typeof tracked.job.input?.bulkImportJobId === "string"
      ? tracked.job.input.bulkImportJobId
      : null;
  if (!bulkImportJobId || !mongoose.Types.ObjectId.isValid(bulkImportJobId)) {
    throw new BackgroundJobError({
      message: "bulkImportJobId is required",
      category: "PREREQUISITE_FAILED",
    });
  }

  const domain = await BulkImportJob.findById(bulkImportJobId);
  if (!domain) {
    throw new BackgroundJobError({
      message: "Bulk import job not found",
      category: "PREREQUISITE_FAILED",
    });
  }
  if (String(domain.schoolId) !== String(tracked.job.schoolId)) {
    throw new BackgroundJobError({
      message: "Bulk import tenant mismatch",
      category: "PREREQUISITE_FAILED",
    });
  }

  if (["completed", "completed_with_errors", "failed"].includes(domain.status) && !domain.fileBytes) {
    return {
      bulkImportJobId,
      processed: domain.totalRows,
      succeeded: domain.successfulRows,
      failed: domain.failedRows,
      notification: notificationFor(domain),
    };
  }

  if (!domain.fileBytes || domain.fileBytes.length === 0) {
    domain.status = "failed";
    domain.rowErrors = [{ row: 0, message: "Import file is missing" }];
    await domain.save();
    throw new BackgroundJobError({
      message: "Import file is missing",
      category: "PERMANENT",
    });
  }

  await tracked.throwIfCancellationRequested();
  domain.status = "processing";
  await domain.save();

  try {
    if (domain.targetKind === "students") {
      await runStudentImport(domain, tracked);
    } else {
      await runTeacherImport(domain, tracked);
    }
  } catch (error) {
    if (error instanceof BackgroundJobError) throw error;
    const message = error instanceof Error ? error.message : "Bulk import failed";
    const permanent = /unsupported|empty|missing required|no data rows|too large|malformed/i.test(
      message
    );
    if (permanent) {
      domain.status = "failed";
      domain.rowErrors = [{ row: 0, message: message.slice(0, 500) }];
      domain.fileBytes = null;
      await domain.save();
    }
    throw new BackgroundJobError({
      message,
      category: permanent ? "PERMANENT" : "RETRYABLE",
    });
  }

  return {
    bulkImportJobId,
    processed: domain.totalRows,
    succeeded: domain.successfulRows,
    failed: domain.failedRows,
    notification: notificationFor(domain),
  };
}

async function runStudentImport(domain: BulkImportDoc, tracked: TrackedJobContext) {
  const rows = parseStudentImportFile(domain.fileBytes as Buffer, domain.fileName);
  let fixedClass = null;
  if (domain.classGroupId) {
    fixedClass = await resolveFixedClassTarget({
      schoolId: domain.schoolId,
      classGroupId: String(domain.classGroupId),
    });
  }
  await tracked.updateProgress({
    progressPercent: 40,
    progressStage: "importing",
    progressMessage: "Importing students",
  });
  const result = await importStudentsFromRows({
    schoolId: domain.schoolId,
    rows,
    fixedClass,
  });

  const keptErrors: typeof result.errors = [];
  let created = result.created;
  let failed = result.failed;
  for (const error of result.errors) {
    if (/duplicate admission/i.test(error.message)) {
      created += 1;
      failed = Math.max(0, failed - 1);
      continue;
    }
    keptErrors.push(error);
  }

  domain.totalRows = rows.length;
  domain.successfulRows = created;
  domain.failedRows = failed;
  domain.rowErrors = keptErrors.slice(0, 500);
  domain.result = { created, failed, errors: domain.rowErrors };
  domain.status =
    failed > 0 && created > 0 ? "completed_with_errors" : created > 0 ? "completed" : "failed";
  domain.fileBytes = null;
  await domain.save();

  if (domain.status === "failed") {
    throw new BackgroundJobError({
      message: domain.rowErrors[0]?.message || "Student import failed",
      category: /empty|maximum|required|unsupported/i.test(keptErrors[0]?.message || "")
        ? "PERMANENT"
        : "RETRYABLE",
    });
  }
}

async function runTeacherImport(domain: BulkImportDoc, tracked: TrackedJobContext) {
  await tracked.updateProgress({
    progressPercent: 40,
    progressStage: "importing",
    progressMessage: "Importing teachers",
  });
  const result = await importTeachersFromBuffer({
    schoolId: domain.schoolId,
    adminUserId: domain.createdBy,
    fileName: domain.fileName,
    fileBytes: domain.fileBytes as Buffer,
  });
  domain.totalRows = result.totalRows;
  domain.successfulRows = result.successful;
  domain.failedRows = result.failed;
  domain.rowErrors = result.results
    .filter((row) => !row.success && row.error)
    .map((row) => ({ row: row.row, message: (row.error || "Failed").slice(0, 500) }))
    .slice(0, 500);
  domain.result = {
    totalRows: result.totalRows,
    successful: result.successful,
    failed: result.failed,
    results: result.results.slice(0, 500),
  };
  domain.status =
    result.failed > 0 && result.successful > 0
      ? "completed_with_errors"
      : result.successful > 0
        ? "completed"
        : "failed";
  domain.fileBytes = null;
  await domain.save();

  if (domain.status === "failed") {
    throw new BackgroundJobError({
      message: domain.rowErrors[0]?.message || "Teacher import failed",
      category: "PERMANENT",
    });
  }
}
