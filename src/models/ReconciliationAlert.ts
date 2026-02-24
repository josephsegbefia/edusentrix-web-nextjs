import { Schema, model, models, Types, type Model } from "mongoose";

export type ReconciliationAlertSeverity = "info" | "warning" | "critical";
export type ReconciliationAlertStatus = "active" | "resolved";

export interface IReconciliationAlert {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  alertKey: string;
  severity: ReconciliationAlertSeverity;
  title: string;
  description: string;
  queue?: string | null;
  count: number;
  status: ReconciliationAlertStatus;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  resolvedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const reconciliationAlertSchema = new Schema<IReconciliationAlert>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    alertKey: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      required: true,
      default: "warning",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    queue: { type: String, default: null, trim: true },
    count: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["active", "resolved"],
      required: true,
      default: "active",
      index: true,
    },
    firstDetectedAt: { type: Date, required: true, default: Date.now },
    lastDetectedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

reconciliationAlertSchema.index(
  { schoolId: 1, alertKey: 1 },
  { unique: true, name: "uniq_reconciliation_alert_key" }
);
reconciliationAlertSchema.index(
  { schoolId: 1, status: 1, severity: 1, lastDetectedAt: -1 },
  { name: "reconciliation_alerts_by_status" }
);

export const ReconciliationAlert: Model<IReconciliationAlert> =
  (models.ReconciliationAlert as Model<IReconciliationAlert>) ||
  model<IReconciliationAlert>("ReconciliationAlert", reconciliationAlertSchema);
