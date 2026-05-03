export type SchemeImportJobStatus = "parsed" | "confirmed" | "cancelled" | "failed";

export type SchemeImportSourceKind = "spreadsheet" | "pdf_ai";

export interface SchemeImportParsedRowClient {
  rowIndex: number;
  weekNumber: number | null;
  title: string;
  learningObjective: string | null;
  notes: string | null;
  skipped: boolean;
  errors: string[];
  /** Populated for PDF + AI imports (0–1). */
  confidence?: number | null;
}

export interface SchemeImportJobRow {
  id: string;
  status: SchemeImportJobStatus;
  sourceKind: SchemeImportSourceKind;
  fileName: string;
  fileUrl: string | null;
  parseError: string | null;
  parsedRows: SchemeImportParsedRowClient[];
  resultSchemeId: string | null;
  createdAt: string;
  updatedAt: string;
}
