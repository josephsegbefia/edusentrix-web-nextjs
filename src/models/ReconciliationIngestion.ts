import { Schema, model, models, Types, type Model } from "mongoose";

export type ReconciliationSourceType = "gateway" | "bank" | "manual";
export type ReconciliationItemStatus =
  | "unmatched"
  | "matched"
  | "ambiguous"
  | "ignored";
export type ReconciliationMatchMethod =
  | "none"
  | "exact_external_id"
  | "exact_reference"
  | "amount_date_single"
  | "manual";

export interface IReconciliationIngestion {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sourceType: ReconciliationSourceType;
  externalTxnId: string;
  normalizedReference?: string | null;
  rawReference?: string | null;
  amountMinor: number;
  currency: string;
  transactionDate: Date;
  payerName?: string | null;
  payerPhone?: string | null;
  payerEmail?: string | null;
  bankAccountName?: string | null;
  channel?: string | null;
  status: ReconciliationItemStatus;
  matchMethod: ReconciliationMatchMethod;
  matchedPaymentId?: Types.ObjectId | null;
  candidatePaymentIds: Types.ObjectId[];
  confidence: number;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  ingestedAt: Date;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const reconciliationIngestionSchema = new Schema<IReconciliationIngestion>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["gateway", "bank", "manual"],
      required: true,
      index: true,
    },
    externalTxnId: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedReference: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    rawReference: {
      type: String,
      default: null,
      trim: true,
    },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "GHS", trim: true },
    transactionDate: { type: Date, required: true, index: true },
    payerName: { type: String, default: null, trim: true },
    payerPhone: { type: String, default: null, trim: true },
    payerEmail: { type: String, default: null, trim: true },
    bankAccountName: { type: String, default: null, trim: true },
    channel: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["unmatched", "matched", "ambiguous", "ignored"],
      required: true,
      default: "unmatched",
      index: true,
    },
    matchMethod: {
      type: String,
      enum: [
        "none",
        "exact_external_id",
        "exact_reference",
        "amount_date_single",
        "manual",
      ],
      required: true,
      default: "none",
    },
    matchedPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    candidatePaymentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    confidence: { type: Number, required: true, min: 0, max: 100, default: 0 },
    notes: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    ingestedAt: { type: Date, required: true, default: Date.now, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

reconciliationIngestionSchema.index(
  { schoolId: 1, sourceType: 1, externalTxnId: 1 },
  { unique: true, name: "uniq_reconciliation_ingestion_source_txn" }
);
reconciliationIngestionSchema.index(
  { schoolId: 1, status: 1, transactionDate: -1 },
  { name: "reconciliation_queue_by_status" }
);

export const ReconciliationIngestion: Model<IReconciliationIngestion> =
  (models.ReconciliationIngestion as Model<IReconciliationIngestion>) ||
  model<IReconciliationIngestion>(
    "ReconciliationIngestion",
    reconciliationIngestionSchema
  );
