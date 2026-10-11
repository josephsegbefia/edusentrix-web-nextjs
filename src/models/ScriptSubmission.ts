import { Schema, model, models, type Model, type Types } from "mongoose";

export const SCRIPT_SUBMISSION_STATUSES = [
  "draft",
  "awaiting_uploads",
  "upload_incomplete",
  "received",
  "cancelled",
  "failed",
] as const;
export type ScriptSubmissionStatus = (typeof SCRIPT_SUBMISSION_STATUSES)[number];

export interface IScriptSubmissionPage {
  pageId: string;
  assetId: Types.ObjectId | null;
  pageNumber: number;
  mimeType: string | null;
  sizeBytes: number | null;
  status: "pending" | "ready";
  createdAt: Date;
  completedAt: Date | null;
}

export type ScriptSubmissionAuditEventType =
  | "created"
  | "page_initialized"
  | "page_completed"
  | "finalized"
  | "cancelled";

export interface IScriptSubmissionAuditEvent {
  type: ScriptSubmissionAuditEventType;
  at: Date;
  actorUserId: Types.ObjectId;
  pageId: string | null;
}

export interface IScriptSubmission {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  studentId: Types.ObjectId;
  submittedByUserId: Types.ObjectId;
  status: ScriptSubmissionStatus;
  idempotencyKey: string;
  pages: IScriptSubmissionPage[];
  auditEvents: IScriptSubmissionAuditEvent[];
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<IScriptSubmissionPage>(
  {
    pageId: { type: String, required: true, trim: true },
    assetId: { type: Schema.Types.ObjectId, default: null },
    pageNumber: { type: Number, required: true, min: 1, max: 200 },
    mimeType: { type: String, default: null, trim: true },
    sizeBytes: { type: Number, default: null, min: 1 },
    status: { type: String, enum: ["pending", "ready"], required: true, default: "pending" },
    createdAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const auditEventSchema = new Schema<IScriptSubmissionAuditEvent>(
  {
    type: { type: String, enum: ["created", "page_initialized", "page_completed", "finalized", "cancelled"], required: true },
    at: { type: Date, required: true, default: Date.now },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pageId: { type: String, default: null },
  },
  { _id: false }
);

const schema = new Schema<IScriptSubmission>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examPaperId: { type: Schema.Types.ObjectId, ref: "ExamPaper", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    submittedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: SCRIPT_SUBMISSION_STATUSES, required: true, default: "draft", index: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 160 },
    pages: { type: [pageSchema], default: [] },
    auditEvents: { type: [auditEventSchema], default: [] },
    finalizedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ schoolId: 1, idempotencyKey: 1 }, { unique: true, name: "unique_script_submission_idempotency" });
schema.index({ schoolId: 1, examPaperId: 1, studentId: 1, createdAt: -1 });
schema.index({ schoolId: 1, submittedByUserId: 1, createdAt: -1 });

export const ScriptSubmission: Model<IScriptSubmission> =
  (models.ScriptSubmission as Model<IScriptSubmission>) ||
  model<IScriptSubmission>("ScriptSubmission", schema);
