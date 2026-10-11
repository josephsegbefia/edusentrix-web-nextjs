import { Schema, model, models, type Model, type Types } from "mongoose";

export const TEACHER_IMPORT_STATUSES = [
  "uploaded",
  "analyzing",
  "review_ready",
  "committing",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
] as const;
export type TeacherImportStatus = (typeof TEACHER_IMPORT_STATUSES)[number];

export const TEACHER_IMPORT_INVITATION_MODES = ["send_now", "create_only"] as const;
export type TeacherImportInvitationMode = (typeof TEACHER_IMPORT_INVITATION_MODES)[number];

export type TeacherImportMappingSource = "exact" | "alias" | "inferred" | "leo" | "admin";
export type TeacherImportResolutionStatus = "resolved" | "needs_review" | "blocked" | "ignored";
export type TeacherImportRowState = "pending" | "ready" | "created" | "existing" | "skipped" | "failed";

export interface ITeacherImportColumnMapping {
  sourceHeader: string;
  canonicalField: string | null;
  source: TeacherImportMappingSource;
  confidence: number;
  status: TeacherImportResolutionStatus;
}

export interface ITeacherImportIssue {
  code: string;
  message: string;
  field?: string | null;
  value?: string | null;
  affectedRows?: number[];
}

export interface ITeacherImportSubjectResolution {
  sourceValue: string;
  subjectFamily?: string | null;
  subjectOfferingIds: string[];
  resolvedNames: string[];
  candidateOptions?: Array<{ id: string; label: string; gradeBand?: string | null }>;
  source: TeacherImportMappingSource;
  status: TeacherImportResolutionStatus;
  affectedRows: number[];
  note?: string | null;
}

export interface ITeacherImportClassResolution {
  sourceValue: string;
  classGroupId?: string | null;
  gradeId?: string | null;
  resolvedLabel?: string | null;
  candidateOptions?: Array<{ id: string; label: string; gradeId: string }>;
  source: TeacherImportMappingSource;
  status: TeacherImportResolutionStatus;
  affectedRows: number[];
  occupiedTeacherId?: string | null;
  occupiedTeacherName?: string | null;
  homeroomDecision?: "keep_existing" | "replace" | "no_assign" | null;
  note?: string | null;
}

export interface ITeacherImportParsedRow {
  sourceRowNumber: number;
  sourceValues: Record<string, string>;
  firstName: string;
  lastName: string;
  fullName?: string | null;
  email: string;
  phone?: string | null;
  employeeId?: string | null;
  department?: string | null;
  status?: string | null;
  subjects: string[];
  subjectOfferingIds: string[];
  subjectIds: string[];
  homeroomClass?: string | null;
  homeroomGrade?: string | null;
  homeroomClassGroupId?: string | null;
  resolutionStatus: TeacherImportResolutionStatus;
  rowState: TeacherImportRowState;
  issues: ITeacherImportIssue[];
  commitError?: string | null;
  teacherId?: string | null;
  invitation?: {
    status: "not_requested" | "sent" | "queued" | "failed";
    warning?: string | null;
    invitationId?: string | null;
  } | null;
}

export interface ITeacherImportAnalysisSummary {
  totalRows: number;
  readyRows: number;
  needsReviewRows: number;
  blockedRows: number;
  existingRows: number;
  mappedColumns: number;
  resolvedSubjectAliases: number;
  resolvedClassAliases: number;
  warnings: number;
  errors: number;
  leoUsed: boolean;
  leoUnavailable: boolean;
}

export interface ITeacherImportJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  status: TeacherImportStatus;
  fileName: string;
  mimeType?: string | null;
  fileBytes?: Buffer | null;
  selectedSheetName?: string | null;
  columnMappings: ITeacherImportColumnMapping[];
  parsedRows: ITeacherImportParsedRow[];
  subjectResolutions: ITeacherImportSubjectResolution[];
  classResolutions: ITeacherImportClassResolution[];
  analysisSummary?: ITeacherImportAnalysisSummary | null;
  analysisWarnings: ITeacherImportIssue[];
  analysisErrors: ITeacherImportIssue[];
  invitationMode: TeacherImportInvitationMode;
  analysisBackgroundJobId?: Types.ObjectId | null;
  commitBackgroundJobId?: Types.ObjectId | null;
  approvedByUserId?: Types.ObjectId | null;
  approvedAt?: Date | null;
  committedAt?: Date | null;
  result?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new Schema<ITeacherImportIssue>(
  {
    code: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    field: { type: String, default: null, maxlength: 100 },
    value: { type: String, default: null, maxlength: 500 },
    affectedRows: { type: [Number], default: [] },
  },
  { _id: false }
);

const columnMappingSchema = new Schema<ITeacherImportColumnMapping>(
  {
    sourceHeader: { type: String, required: true, maxlength: 200 },
    canonicalField: { type: String, default: null, maxlength: 100 },
    source: { type: String, enum: ["exact", "alias", "inferred", "leo", "admin"], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    status: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true },
  },
  { _id: false }
);

const parsedRowSchema = new Schema<ITeacherImportParsedRow>(
  {
    sourceRowNumber: { type: Number, required: true },
    sourceValues: { type: Map, of: String, default: {} },
    firstName: { type: String, default: "", maxlength: 200 },
    lastName: { type: String, default: "", maxlength: 200 },
    fullName: { type: String, default: null, maxlength: 400 },
    email: { type: String, default: "", maxlength: 320 },
    phone: { type: String, default: null, maxlength: 100 },
    employeeId: { type: String, default: null, maxlength: 160 },
    department: { type: String, default: null, maxlength: 200 },
    status: { type: String, default: null, maxlength: 80 },
    subjects: { type: [String], default: [] },
    subjectOfferingIds: { type: [String], default: [] },
    subjectIds: { type: [String], default: [] },
    homeroomClass: { type: String, default: null, maxlength: 200 },
    homeroomGrade: { type: String, default: null, maxlength: 200 },
    homeroomClassGroupId: { type: String, default: null, maxlength: 80 },
    resolutionStatus: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true },
    rowState: { type: String, enum: ["pending", "ready", "created", "existing", "skipped", "failed"], required: true },
    issues: { type: [issueSchema], default: [] },
    commitError: { type: String, default: null, maxlength: 1000 },
    teacherId: { type: String, default: null, maxlength: 80 },
    invitation: {
      status: { type: String, enum: ["not_requested", "sent", "queued", "failed"], default: "not_requested" },
      warning: { type: String, default: null, maxlength: 1000 },
      invitationId: { type: String, default: null, maxlength: 80 },
    },
  },
  { _id: false }
);

const subjectResolutionSchema = new Schema<ITeacherImportSubjectResolution>(
  {
    sourceValue: { type: String, required: true, maxlength: 300 },
    subjectFamily: { type: String, default: null, maxlength: 200 },
    subjectOfferingIds: { type: [String], default: [] },
    resolvedNames: { type: [String], default: [] },
    candidateOptions: {
      type: [{ id: String, label: String, gradeBand: { type: String, default: null } }],
      default: [],
    },
    source: { type: String, enum: ["exact", "alias", "inferred", "leo", "admin"], required: true },
    status: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true },
    affectedRows: { type: [Number], default: [] },
    note: { type: String, default: null, maxlength: 1000 },
  },
  { _id: false }
);

const classResolutionSchema = new Schema<ITeacherImportClassResolution>(
  {
    sourceValue: { type: String, required: true, maxlength: 300 },
    classGroupId: { type: String, default: null, maxlength: 80 },
    gradeId: { type: String, default: null, maxlength: 80 },
    resolvedLabel: { type: String, default: null, maxlength: 300 },
    candidateOptions: {
      type: [{ id: String, label: String, gradeId: String }],
      default: [],
    },
    source: { type: String, enum: ["exact", "alias", "inferred", "leo", "admin"], required: true },
    status: { type: String, enum: ["resolved", "needs_review", "blocked", "ignored"], required: true },
    affectedRows: { type: [Number], default: [] },
    occupiedTeacherId: { type: String, default: null, maxlength: 80 },
    occupiedTeacherName: { type: String, default: null, maxlength: 400 },
    homeroomDecision: { type: String, enum: ["keep_existing", "replace", "no_assign", null], default: null },
    note: { type: String, default: null, maxlength: 1000 },
  },
  { _id: false }
);

const summarySchema = new Schema<ITeacherImportAnalysisSummary>(
  {
    totalRows: { type: Number, default: 0 },
    readyRows: { type: Number, default: 0 },
    needsReviewRows: { type: Number, default: 0 },
    blockedRows: { type: Number, default: 0 },
    existingRows: { type: Number, default: 0 },
    mappedColumns: { type: Number, default: 0 },
    resolvedSubjectAliases: { type: Number, default: 0 },
    resolvedClassAliases: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    leoUsed: { type: Boolean, default: false },
    leoUnavailable: { type: Boolean, default: false },
  },
  { _id: false }
);

const teacherImportJobSchema = new Schema<ITeacherImportJob>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: TEACHER_IMPORT_STATUSES, default: "uploaded", index: true },
    fileName: { type: String, required: true, trim: true, maxlength: 400 },
    mimeType: { type: String, default: null, maxlength: 160 },
    fileBytes: { type: Buffer, default: null },
    selectedSheetName: { type: String, default: null, maxlength: 200 },
    columnMappings: { type: [columnMappingSchema], default: [] },
    parsedRows: { type: [parsedRowSchema], default: [] },
    subjectResolutions: { type: [subjectResolutionSchema], default: [] },
    classResolutions: { type: [classResolutionSchema], default: [] },
    analysisSummary: { type: summarySchema, default: null },
    analysisWarnings: { type: [issueSchema], default: [] },
    analysisErrors: { type: [issueSchema], default: [] },
    invitationMode: { type: String, enum: TEACHER_IMPORT_INVITATION_MODES, default: "send_now" },
    analysisBackgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null },
    commitBackgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    committedAt: { type: Date, default: null },
    result: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

teacherImportJobSchema.index({ schoolId: 1, createdAt: -1 });

export const TeacherImportJob: Model<ITeacherImportJob> =
  (models.TeacherImportJob as Model<ITeacherImportJob>) ||
  model<ITeacherImportJob>("TeacherImportJob", teacherImportJobSchema);
