export const IMPORT_LEO_CAPABILITY = "LEO_IMPORT_ASSIST" as const;

export const IMPORT_LEO_TASKS = [
  "inspect_file_structure",
  "map_columns",
  "interpret_vocabulary",
  "analyse_import",
  "interpret_admin_instruction",
  "attention_assessment",
] as const;
export type ImportLeoTask = (typeof IMPORT_LEO_TASKS)[number];

export type ImportDomain = "teacher" | "student";

export const IMPORT_AI_ERROR_CODES = [
  "IMPORT_AI_UNAVAILABLE",
  "IMPORT_AI_TIMEOUT",
  "IMPORT_AI_INVALID_RESPONSE",
  "IMPORT_AI_PROVIDER_ERROR",
  "IMPORT_AI_CONTEXT_TOO_LARGE",
  "IMPORT_AI_VALIDATION_FAILED",
] as const;
export type ImportAiErrorCode = (typeof IMPORT_AI_ERROR_CODES)[number];

export type ImportLeoAccessReasonCode =
  | "available"
  | "provider_not_configured"
  | "runtime_disabled"
  | "platform_disabled"
  | "privacy_disabled"
  | "unauthorized"
  | "provider_unavailable";

export type ImportLeoAccessResult = {
  available: boolean;
  reasonCode: ImportLeoAccessReasonCode;
  retryable: boolean;
};

export type ImportLeoStatus = "pending" | "running" | "completed" | "degraded" | "unavailable";
export type ImportLeoReasonCode =
  | ImportLeoAccessReasonCode
  | "timeout"
  | "provider_error"
  | "invalid_response"
  | "context_too_large"
  | "validation_failed";

export type ImportLeoMetadata = {
  status: ImportLeoStatus;
  reasonCode?: ImportLeoReasonCode | null;
  reason?: string | null;
  provider?: string | null;
  model?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  retryable?: boolean;
  attempts?: number;
  inputCount?: number;
  recommendationCount?: number;
  autoResolved?: number;
  reviewRequired?: number;
  lastErrorCode?: ImportAiErrorCode | null;
  task?: ImportLeoTask | null;
  domain?: ImportDomain | null;
  importJobId?: string | null;
};

export type ImportWorkbookInspection = {
  fileType: "csv" | "xls" | "xlsx" | "unknown";
  sheets: ImportSheetInspection[];
};

export type ImportSheetInspection = {
  sheetKey: string;
  sourceName: string;
  rowCount: number;
  headers: string[];
  structuralSignals: string[];
  inferredTypes: Record<string, "text" | "number" | "date" | "boolean" | "mixed" | "unknown">;
};

export type ImportColumnInterpretation = {
  sourceColumn: string;
  sourceColumnKey: string;
  proposedCanonicalField: string | null;
  source: "exact" | "deterministic_alias" | "structural" | "leo" | "admin";
  confidenceBand: "high" | "medium" | "low";
  requiresConfirmation: boolean;
  explanation: string;
  contributesTo?: string[];
  transformation?: "none" | "split_name" | "expand_list" | "associate_context" | "normalize_value";
};

export type ImportRowReference = `T${string}` | `S${string}`;

export type ImportResolutionClass = "AUTO" | "REVIEW" | "BLOCKING";
export type ImportResolutionSource = "deterministic" | "leo" | "admin" | "admin_via_leo" | "admin_apply_similar";
export type ImportIssueStatus = "open" | "resolved" | "ignored";

export type ImportIssueV2 = {
  issueId: string;
  domain: ImportDomain;
  scope: "file" | "sheet" | "column" | "row" | "group";
  rowRefs: ImportRowReference[];
  fieldKey?: string | null;
  issueType: string;
  severity: "info" | "warning" | "blocking";
  sourceValues: string[];
  explanation: string;
  recommendedAction?: string | null;
  candidateActions: ImportProposedAction[];
  resolutionClass: ImportResolutionClass;
  requiresHumanConfirmation: boolean;
  status: ImportIssueStatus;
  resolvedAction?: ImportProposedAction | null;
  resolvedBy?: ImportResolutionSource | null;
  /** Safe grouping metadata. It is descriptive and never replaces row provenance. */
  context?: {
    gradeBand?: string | null;
    gradeIds?: string[];
    candidateOfferingIds?: string[];
    similarityKey?: string | null;
  } | null;
  affectedCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type ImportActionType =
  | "map_column"
  | "select_catalog_item"
  | "ignore_source_value"
  | "set_field_value"
  | "split_name"
  | "associate_context"
  | "remove_association"
  | "keep_existing"
  | "flag_for_manual_entry"
  // Teacher-import review relationship actions. These are proposals only;
  // BI.4 is responsible for turning confirmed import state into domain writes.
  | "choose_homeroom"
  | "replace_homeroom"
  | "clear_homeroom"
  | "add_subject_profile"
  | "remove_subject_profile"
  | "add_grade_context"
  | "remove_grade_context"
  | "add_class_context"
  | "remove_class_context"
  | "add_assignment_proposal"
  | "remove_assignment_proposal"
  | "confirm_coteaching";

export type ImportProposedAction = {
  actionId: string;
  type: ImportActionType;
  issueId?: string | null;
  rowRefs: ImportRowReference[];
  [key: string]: unknown;
};

export type ImportNaturalLanguageResolution = {
  instructionId: string;
  issueId: string;
  instructionText: string;
  submittedBy: string;
  submittedAt: string;
  interpretationStatus: "pending" | "interpreted" | "invalid" | "failed";
  proposedActions: ImportProposedAction[];
  explanation: string | null;
  confirmationText: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export type ImportV1CompatibilityOutcome =
  | "compatible"
  | "reanalysis_required"
  | "restart_required";

export type ImportReviewDto = {
  state: "active" | "paused" | "cancel_requested" | "cancelled" | "committing" | "completed" | "failed";
  summary: Record<string, unknown> | null;
  currentIssues: ImportIssueV2[];
  resolvedCounts: {
    automatic: number;
    admin: number;
    leo: number;
    open: number;
  };
};
