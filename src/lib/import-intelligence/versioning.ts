import type { ImportV1CompatibilityOutcome } from "./types";

export const IMPORT_SCHEMA_VERSION = 2 as const;
export const IMPORT_ANALYSIS_VERSION = "v2" as const;

export type ImportVersionFields = {
  importSchemaVersion?: number | null;
  analysisVersion?: string | null;
};

export function importVersionFields(): ImportVersionFields {
  return { importSchemaVersion: IMPORT_SCHEMA_VERSION, analysisVersion: IMPORT_ANALYSIS_VERSION };
}

export function compatibilityForImportJob(job: {
  importSchemaVersion?: unknown;
  analysisVersion?: unknown;
  fileBytes?: unknown;
  parsedRows?: unknown;
}): { outcome: ImportV1CompatibilityOutcome; reason: string } {
  if (job.importSchemaVersion === IMPORT_SCHEMA_VERSION && job.analysisVersion === IMPORT_ANALYSIS_VERSION) {
    return { outcome: "compatible", reason: "This import already has the V2 analysis shape." };
  }
  const hasSource = (Buffer.isBuffer(job.fileBytes) && job.fileBytes.length > 0) ||
    (job.fileBytes instanceof Uint8Array && job.fileBytes.length > 0) ||
    (Array.isArray(job.parsedRows) && job.parsedRows.length > 0);
  return hasSource
    ? { outcome: "reanalysis_required", reason: "This older import has enough retained source state for a future V2 re-analysis." }
    : { outcome: "restart_required", reason: "This older import no longer contains enough retained source state for safe V2 re-analysis." };
}
