import { Schema, model, models, type Model, type Types } from "mongoose";
import type { ImportLeoMetadata } from "@/lib/leo/import-types";
import type { ImportColumnInterpretation, ImportIssueV2, ImportNaturalLanguageResolution, ImportWorkbookInspection } from "@/lib/import-intelligence/types";

export const STUDENT_IMPORT_STATUSES = [
  "uploaded",
  "analyzing",
  "review_ready",
  "committing",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
] as const;
export type StudentImportStatus = (typeof STUDENT_IMPORT_STATUSES)[number];

export type StudentImportResolutionStatus = "resolved" | "needs_review" | "blocked" | "ignored";
export type StudentImportRowState = "pending" | "ready" | "existing" | "skipped" | "created" | "failed";
export type StudentImportMappingSource = "exact" | "alias" | "inferred" | "leo" | "admin";
export type StudentImportPlacementMode = "school_wide" | "class_scoped";
export type StudentImportDateFormat = "auto" | "dmy" | "mdy";

export const STUDENT_IMPORT_CANONICAL_FIELDS = [
  "firstName", "middleName", "lastName", "fullName", "admissionNo", "sex",
  "dateOfBirth", "gradeName", "gradeId", "className", "classGroupId", "status",
  "enrolledAt", "gesIndexNumber", "gesSchoolCode",
] as const;
export type StudentImportCanonicalField = (typeof STUDENT_IMPORT_CANONICAL_FIELDS)[number];

export interface IStudentImportIssue {
  code: string;
  message: string;
  field?: string | null;
  value?: string | null;
  affectedRows?: number[];
}

export interface IStudentImportColumnMapping {
  sourceHeader: string;
  canonicalField: StudentImportCanonicalField | null;
  source: StudentImportMappingSource;
  confidence: number;
  status: StudentImportResolutionStatus;
}

export interface IStudentImportCandidateOption {
  id: string;
  label: string;
  gradeId?: string | null;
  gradeName?: string | null;
}

export interface IStudentImportGradeResolution {
  sourceValue: string;
  gradeId?: string | null;
  resolvedLabel?: string | null;
  candidateOptions: IStudentImportCandidateOption[];
  source: StudentImportMappingSource;
  status: StudentImportResolutionStatus;
  affectedRows: number[];
  note?: string | null;
}

export interface IStudentImportClassResolution {
  sourceValue: string;
  gradeId?: string | null;
  classGroupId?: string | null;
  resolvedLabel?: string | null;
  candidateOptions: IStudentImportCandidateOption[];
  source: StudentImportMappingSource;
  status: StudentImportResolutionStatus;
  affectedRows: number[];
  currentCount?: number | null;
  capacity?: number | null;
  projectedCount?: number | null;
  note?: string | null;
}

export interface IStudentImportParsedRow {
  sourceRowNumber: number;
  sourceSheetName: string;
  sourceValues: Record<string, string>;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName?: string | null;
  admissionNo?: string | null;
  sex?: "male" | "female" | null;
  dateOfBirth?: string | null;
  enrolledAt?: string | null;
  gradeName?: string | null;
  gradeId?: string | null;
  className?: string | null;
  classGroupId?: string | null;
  status: "active" | "inactive" | "withdrawn" | "graduated";
  rawStatus?: string | null;
  rawSex?: string | null;
  gesIndexNumber?: string | null;
  gesSchoolCode?: string | null;
  resolutionStatus: StudentImportResolutionStatus;
  rowState: StudentImportRowState;
  issues: IStudentImportIssue[];
  studentId?: string | null;
  commitError?: string | null;
  usageRecorded?: boolean;
}

export interface IStudentImportDateExample {
  field: "dateOfBirth" | "enrolledAt";
  rawValue: string;
  dayMonthYear: string | null;
  monthDayYear: string | null;
  status: "resolved" | "ambiguous" | "invalid";
}

export interface IStudentImportAnalysisSummary {
  totalRows: number;
  readyRows: number;
  needsReviewRows: number;
  blockedRows: number;
  existingRows: number;
  mappedColumns: number;
  resolvedGradeAliases: number;
  resolvedClassAliases: number;
  resolvedDateValues: number;
  possibleDuplicates: number;
  capacityBlockedRows: number;
  currentStudentCount: number;
  projectedNewStudents: number;
  studentLimit: number | null;
  studentLimitAvailable: number | null;
  leoUsed: boolean;
  leoUnavailable: boolean;
}

export interface IStudentImportJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  status: StudentImportStatus;
  fileName: string;
  mimeType?: string | null;
  fileBytes?: Buffer | null;
  placementMode: StudentImportPlacementMode;
  fixedClassGroupId?: Types.ObjectId | null;
  fixedGradeId?: Types.ObjectId | null;
  fixedClassLabel?: string | null;
  classConflictPolicy: "review" | "use_target";
  selectedSheetName?: string | null;
  availableSheets: Array<{ name: string; score: number; rowCount: number; signals: string[] }>;
  sheetSelectionRequired: boolean;
  dateFormat: StudentImportDateFormat;
  dateExamples: IStudentImportDateExample[];
  columnMappings: IStudentImportColumnMapping[];
  unusedColumns: string[];
  parsedRows: IStudentImportParsedRow[];
  gradeResolutions: IStudentImportGradeResolution[];
  classResolutions: IStudentImportClassResolution[];
  analysisSummary?: IStudentImportAnalysisSummary | null;
  analysisWarnings: IStudentImportIssue[];
  analysisErrors: IStudentImportIssue[];
  analysisBackgroundJobId?: Types.ObjectId | null;
  commitBackgroundJobId?: Types.ObjectId | null;
  approvedByUserId?: Types.ObjectId | null;
  approvedAt?: Date | null;
  committedAt?: Date | null;
  result?: Record<string, unknown> | null;
  leoAnalysis?: ImportLeoMetadata | null;
  importSchemaVersion?: number | null;
  analysisVersion?: string | null;
  workbookInspection?: ImportWorkbookInspection | null;
  columnInterpretations?: ImportColumnInterpretation[];
  analysisIssues?: ImportIssueV2[];
  naturalLanguageResolutions?: ImportNaturalLanguageResolution[];
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new Schema<IStudentImportIssue>({
  code: { type: String, required: true, maxlength: 100 },
  message: { type: String, required: true, maxlength: 1000 },
  field: { type: String, default: null, maxlength: 100 },
  value: { type: String, default: null, maxlength: 500 },
  affectedRows: { type: [Number], default: [] },
}, { _id: false });

const mappingSchema = new Schema<IStudentImportColumnMapping>({
  sourceHeader: { type: String, required: true, maxlength: 200 },
  canonicalField: { type: String, default: null, maxlength: 100 },
  source: { type: String, enum: ["exact", "alias", "inferred", "leo", "admin"], required: true },
  confidence: { type: Number, min: 0, max: 1, required: true },
  status: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true },
}, { _id: false });

const candidateSchema = new Schema<IStudentImportCandidateOption>({
  id: { type: String, required: true }, label: { type: String, required: true },
  gradeId: { type: String, default: null }, gradeName: { type: String, default: null },
}, { _id: false });

const parsedRowSchema = new Schema<IStudentImportParsedRow>({
  sourceRowNumber: { type: Number, required: true }, sourceSheetName: { type: String, required: true },
  sourceValues: { type: Map, of: String, default: {} }, firstName: { type: String, default: "" },
  middleName: { type: String, default: null }, lastName: { type: String, default: "" }, fullName: { type: String, default: null },
  admissionNo: { type: String, default: null }, sex: { type: String, enum: ["male", "female", null], default: null },
  dateOfBirth: { type: String, default: null }, enrolledAt: { type: String, default: null },
  gradeName: { type: String, default: null }, gradeId: { type: String, default: null },
  className: { type: String, default: null }, classGroupId: { type: String, default: null },
  status: { type: String, enum: ["active", "inactive", "withdrawn", "graduated"], required: true },
  rawStatus: { type: String, default: null }, rawSex: { type: String, default: null },
  gesIndexNumber: { type: String, default: null }, gesSchoolCode: { type: String, default: null },
  resolutionStatus: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true },
  rowState: { type: String, enum: ["pending", "ready", "existing", "skipped", "created", "failed"], required: true },
  issues: { type: [issueSchema], default: [] }, studentId: { type: String, default: null },
  commitError: { type: String, default: null }, usageRecorded: { type: Boolean, default: false },
}, { _id: false });

const gradeResolutionSchema = new Schema<IStudentImportGradeResolution>({
  sourceValue: { type: String, required: true }, gradeId: { type: String, default: null }, resolvedLabel: { type: String, default: null },
  candidateOptions: { type: [candidateSchema], default: [] }, source: { type: String, enum: ["exact", "alias", "inferred", "leo", "admin"], required: true },
  status: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true }, affectedRows: { type: [Number], default: [] }, note: { type: String, default: null },
}, { _id: false });

const classResolutionSchema = new Schema<IStudentImportClassResolution>({
  sourceValue: { type: String, required: true }, gradeId: { type: String, default: null }, classGroupId: { type: String, default: null }, resolvedLabel: { type: String, default: null },
  candidateOptions: { type: [candidateSchema], default: [] }, source: { type: String, enum: ["exact", "alias", "inferred", "leo", "admin"], required: true },
  status: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true }, affectedRows: { type: [Number], default: [] },
  currentCount: { type: Number, default: null }, capacity: { type: Number, default: null }, projectedCount: { type: Number, default: null }, note: { type: String, default: null },
}, { _id: false });

const dateExampleSchema = new Schema<IStudentImportDateExample>({
  field: { type: String, enum: ["dateOfBirth", "enrolledAt"], required: true }, rawValue: { type: String, required: true },
  dayMonthYear: { type: String, default: null }, monthDayYear: { type: String, default: null }, status: { type: String, enum: ["resolved", "ambiguous", "invalid"], required: true },
}, { _id: false });

const studentImportJobSchema = new Schema<IStudentImportJob>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true }, status: { type: String, enum: STUDENT_IMPORT_STATUSES, default: "uploaded", index: true },
  fileName: { type: String, required: true, maxlength: 400 }, mimeType: { type: String, default: null }, fileBytes: { type: Buffer, default: null },
  placementMode: { type: String, enum: ["school_wide", "class_scoped"], required: true }, fixedClassGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", default: null }, fixedGradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null }, fixedClassLabel: { type: String, default: null }, classConflictPolicy: { type: String, enum: ["review", "use_target"], default: "review" },
  selectedSheetName: { type: String, default: null }, availableSheets: { type: [{ name: String, score: Number, rowCount: Number, signals: [String] }], default: [] }, sheetSelectionRequired: { type: Boolean, default: false }, dateFormat: { type: String, enum: ["auto", "dmy", "mdy"], default: "auto" }, dateExamples: { type: [dateExampleSchema], default: [] },
  columnMappings: { type: [mappingSchema], default: [] }, unusedColumns: { type: [String], default: [] }, parsedRows: { type: [parsedRowSchema], default: [] }, gradeResolutions: { type: [gradeResolutionSchema], default: [] }, classResolutions: { type: [classResolutionSchema], default: [] }, analysisSummary: { type: Schema.Types.Mixed, default: null }, analysisWarnings: { type: [issueSchema], default: [] }, analysisErrors: { type: [issueSchema], default: [] },
  analysisBackgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null }, commitBackgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null }, approvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null }, approvedAt: { type: Date, default: null }, committedAt: { type: Date, default: null }, result: { type: Schema.Types.Mixed, default: null }, leoAnalysis: { type: Schema.Types.Mixed, default: null }, importSchemaVersion: { type: Number, default: null }, analysisVersion: { type: String, default: null }, workbookInspection: { type: Schema.Types.Mixed, default: null }, columnInterpretations: { type: [Schema.Types.Mixed], default: [] }, analysisIssues: { type: [Schema.Types.Mixed], default: [] }, naturalLanguageResolutions: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true, suppressReservedKeysWarning: true });

studentImportJobSchema.index({ schoolId: 1, createdAt: -1 });

export const StudentImportJob: Model<IStudentImportJob> =
  (models.StudentImportJob as Model<IStudentImportJob>) || model<IStudentImportJob>("StudentImportJob", studentImportJobSchema);
