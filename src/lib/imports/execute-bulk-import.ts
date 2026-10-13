import "server-only";

import { BackgroundJobError } from "@/lib/background/errors";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import { resolveBulkImportRouting } from "@/lib/imports/bulk-import-routing";
import {
  LEGACY_BULK_IMPORT_SUPERSEDED_CODE,
  LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE,
  quarantineLegacyBulkImport,
} from "@/lib/imports/legacy-bulk-import-quarantine";
import {
  executeTeacherImportAnalysis,
  executeTeacherImportCommit,
} from "@/lib/teachers/teacher-import-workflow";
import {
  executeStudentImportAnalysis,
  executeStudentImportCommit,
} from "@/lib/students/student-import-workflow";

/**
 * The shared Inngest function transports staged teacher and student work, but
 * must never use the retired direct BulkImportJob executors. Those executors
 * can create records before an administrator has explicitly confirmed review.
 */
export async function executeBulkImport(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const resolved = resolveBulkImportRouting(tracked.job);
  if (!resolved.ok) {
    throw new BackgroundJobError({
      code: resolved.code,
      message: resolved.message,
      category: "PREREQUISITE_FAILED",
    });
  }

  const { routing } = resolved;
  if (routing.kind === "teacher_staged") {
    return routing.phase === "analysis"
      ? executeTeacherImportAnalysis(tracked)
      : executeTeacherImportCommit(tracked);
  }

  if (routing.kind === "student_staged") {
    return routing.phase === "analysis"
      ? executeStudentImportAnalysis(tracked)
      : executeStudentImportCommit(tracked);
  }

  if (!tracked.job.schoolId) {
    throw new BackgroundJobError({
      code: "BULK_IMPORT_ROUTING_INVALID",
      message: "Legacy bulk import routing is missing its school scope.",
      category: "PREREQUISITE_FAILED",
    });
  }
  await quarantineLegacyBulkImport({
    bulkImportJobId: routing.importJobId,
    schoolId: tracked.job.schoolId,
  });
  throw new BackgroundJobError({
    code: LEGACY_BULK_IMPORT_SUPERSEDED_CODE,
    message: LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE,
    category: "PERMANENT",
  });
}
