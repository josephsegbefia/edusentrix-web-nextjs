import { Schema, model, models, Types, type Model } from "mongoose";

export interface IReconciliationRun {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  mode: "manual" | "scheduled";
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date | null;
  triggeredBy?: Types.ObjectId | null;
  summary: {
    inspectedIngestion: number;
    matched: number;
    ambiguous: number;
    unchanged: number;
    staleEscalated: number;
    paymentStatusUpdated: number;
    errors: number;
  };
  notes?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const reconciliationRunSchema = new Schema<IReconciliationRun>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["manual", "scheduled"],
      required: true,
      default: "manual",
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: true,
      default: "running",
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    summary: {
      type: {
        inspectedIngestion: { type: Number, required: true, default: 0 },
        matched: { type: Number, required: true, default: 0 },
        ambiguous: { type: Number, required: true, default: 0 },
        unchanged: { type: Number, required: true, default: 0 },
        staleEscalated: { type: Number, required: true, default: 0 },
        paymentStatusUpdated: { type: Number, required: true, default: 0 },
        errors: { type: Number, required: true, default: 0 },
      },
      required: true,
      default: {
        inspectedIngestion: 0,
        matched: 0,
        ambiguous: 0,
        unchanged: 0,
        staleEscalated: 0,
        paymentStatusUpdated: 0,
        errors: 0,
      },
    },
    notes: { type: String, default: null, trim: true },
    errorMessage: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

reconciliationRunSchema.index(
  { schoolId: 1, startedAt: -1 },
  { name: "reconciliation_runs_by_school" }
);

export const ReconciliationRun: Model<IReconciliationRun> =
  (models.ReconciliationRun as Model<IReconciliationRun>) ||
  model<IReconciliationRun>("ReconciliationRun", reconciliationRunSchema);
