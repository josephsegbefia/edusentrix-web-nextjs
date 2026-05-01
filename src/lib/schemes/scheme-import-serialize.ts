import type { ISchemeImportJob } from "@/models/SchemeImportJob";

export function serializeSchemeImportJob(job: ISchemeImportJob) {
  return {
    id: String(job._id),
    status: job.status,
    fileName: job.fileName,
    fileUrl: job.fileUrl ?? null,
    parseError: job.parseError ?? null,
    parsedRows: job.parsedRows,
    resultSchemeId: job.resultSchemeId ? String(job.resultSchemeId) : null,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}
