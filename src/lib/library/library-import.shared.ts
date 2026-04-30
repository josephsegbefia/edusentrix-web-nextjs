import type { ILibraryImportJob } from "@/models/LibraryImportJob";

/** Job is finished — safe to stop polling the import status endpoint. */
export const TERMINAL_LIBRARY_IMPORT_STATUSES = new Set<
  ILibraryImportJob["status"]
>(["completed", "failed", "completed_with_errors"]);

/** API shape — never includes transient `csvText`. */
export function serializeImportJob(doc: ILibraryImportJob) {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    type: doc.type,
    status: doc.status,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    totalRows: doc.totalRows,
    successfulRows: doc.successfulRows,
    failedRows: doc.failedRows,
    errors: doc.errors,
    createdBy: String(doc.createdBy),
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

export type SerializedLibraryImportJob = ReturnType<typeof serializeImportJob>;
