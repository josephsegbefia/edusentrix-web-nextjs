export type SchemeImportJobStatus = "parsed" | "confirmed" | "cancelled" | "failed";

export type SchemeImportSourceKind = "spreadsheet" | "pdf_ai" | "pdf_gemini" | "pdf_manual";

export interface SchemeImportParsedRowClient {
  rowIndex: number;
  weekNumber: number | null;
  weekEnding?: string | null;
  title: string;
  strand?: string | null;
  subStrand?: string | null;
  contentStandard?: string | null;
  indicators?: string[];
  resources?: string[];
  learningObjective: string | null;
  notes: string | null;
  rowType?: "teaching" | "revision" | "examination" | "holiday" | "other";
  skipped: boolean;
  errors: string[];
  /** Populated for PDF imports (0–1). */
  confidence?: number | null;
  rawText?: string | null;
}

export interface SchemeImportJobRow {
  id: string;
  status: SchemeImportJobStatus;
  sourceKind: SchemeImportSourceKind;
  fileName: string;
  fileUrl: string | null;
  parseError: string | null;
  parseWarning: string | null;
  parsedRows: SchemeImportParsedRowClient[];
  resultSchemeId: string | null;
  createdAt: string;
  updatedAt: string;
}
