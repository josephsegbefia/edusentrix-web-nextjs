import { Schema, model, models, Types, type Model } from "mongoose";

export type ReconciliationSessionStatus =
  | "preparing"
  | "in_progress"
  | "review"
  | "locked"
  | "reopened";

export interface IReconciliationSessionEvent {
  action: string;
  userId: Types.ObjectId | null;
  at: Date;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface IReconciliationSessionSummary {
  totalIngested: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  ignored: number;
  paymentStatusUpdated: number;
  aiSuggestionsAccepted: number;
  aiSuggestionsRejected: number;
  manualMatches: number;
  errors: number;
}

export interface IReconciliationSession {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  label: string;
  status: ReconciliationSessionStatus;
  currentStep: string;
  createdBy: Types.ObjectId;
  lockedBy?: Types.ObjectId | null;
  lockedAt?: Date | null;
  lockReason?: string | null;
  reopenedBy?: Types.ObjectId | null;
  reopenedAt?: Date | null;
  reopenReason?: string | null;
  sourceTypes: string[];
  dateRange?: {
    startDate?: Date | null;
    endDate?: Date | null;
  } | null;
  prepareNotes?: string | null;
  importNotes?: string | null;
  reviewNotes?: string | null;
  finalizeNotes?: string | null;
  runIds: Types.ObjectId[];
  summary: IReconciliationSessionSummary;
  reportVerificationId?: string | null;
  timeline: IReconciliationSessionEvent[];
  metadata?: Record<string, unknown> | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionEventSchema = new Schema<IReconciliationSessionEvent>(
  {
    action: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, required: true, default: Date.now },
    reason: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const sessionSummarySchema = new Schema<IReconciliationSessionSummary>(
  {
    totalIngested: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    ambiguous: { type: Number, default: 0 },
    unmatched: { type: Number, default: 0 },
    ignored: { type: Number, default: 0 },
    paymentStatusUpdated: { type: Number, default: 0 },
    aiSuggestionsAccepted: { type: Number, default: 0 },
    aiSuggestionsRejected: { type: Number, default: 0 },
    manualMatches: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const reconciliationSessionSchema = new Schema<IReconciliationSession>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["preparing", "in_progress", "review", "locked", "reopened"],
      required: true,
      default: "preparing",
      index: true,
    },
    currentStep: { type: String, required: true, default: "prepare" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lockedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lockedAt: { type: Date, default: null },
    lockReason: { type: String, default: null, trim: true },
    reopenedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reopenedAt: { type: Date, default: null },
    reopenReason: { type: String, default: null, trim: true },
    sourceTypes: {
      type: [String],
      default: [],
    },
    dateRange: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    prepareNotes: { type: String, default: null, trim: true, maxlength: 2000 },
    importNotes: { type: String, default: null, trim: true, maxlength: 2000 },
    reviewNotes: { type: String, default: null, trim: true, maxlength: 2000 },
    finalizeNotes: { type: String, default: null, trim: true, maxlength: 2000 },
    runIds: [{ type: Schema.Types.ObjectId, ref: "ReconciliationRun" }],
    summary: { type: sessionSummarySchema, required: true, default: () => ({}) },
    reportVerificationId: { type: String, default: null, trim: true },
    timeline: { type: [sessionEventSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reconciliationSessionSchema.index(
  { schoolId: 1, createdAt: -1 },
  { name: "recon_sessions_by_school" }
);
reconciliationSessionSchema.index(
  { schoolId: 1, status: 1, createdAt: -1 },
  { name: "recon_sessions_by_status" }
);

export const ReconciliationSession: Model<IReconciliationSession> =
  (models.ReconciliationSession as Model<IReconciliationSession>) ||
  model<IReconciliationSession>(
    "ReconciliationSession",
    reconciliationSessionSchema
  );
