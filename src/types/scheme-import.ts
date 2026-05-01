export type SchemeImportJobStatus = "parsed" | "confirmed" | "cancelled" | "failed";

export interface SchemeImportParsedRowClient {
  rowIndex: number;
  weekNumber: number | null;
  title: string;
  learningObjective: string | null;
  notes: string | null;
  skipped: boolean;
  errors: string[];
}

export interface SchemeImportJobRow {
  id: string;
  status: SchemeImportJobStatus;
  fileName: string;
  fileUrl: string | null;
  parseError: string | null;
  parsedRows: SchemeImportParsedRowClient[];
  resultSchemeId: string | null;
  createdAt: string;
  updatedAt: string;
}
