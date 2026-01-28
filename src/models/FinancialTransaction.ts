// src/models/FinancialTransaction.ts
// Central ledger model for all money movements (inflows/outflows)
// This is the single source of truth for school finances

import { Schema, model, models, Types } from "mongoose";

// ========================
// Enums
// ========================

export type TransactionDirection = "inflow" | "outflow";

export type TransactionStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "refunded"
  | "reversed"
  | "voided"
  | "disputed"
  | "held";

export type TransactionCategory =
  | "fees"
  | "store"
  | "fundraising"
  | "expenses"
  | "other_income"
  | "refund"
  | "adjustment"
  | "gateway_fee"
  | "bank_charge"
  | "penalty"
  | "discount";

export type TransactionSourceModule =
  | "fees"
  | "store"
  | "community"
  | "fundraising"
  | "expenses"
  | "manual";

export type TransactionMethod =
  | "cash"
  | "mobile_money"
  | "bank_transfer"
  | "card"
  | "cheque"
  | "other";

export type TransactionChannel =
  | "in_app"
  | "web"
  | "mobile"
  | "pos"
  | "offline";

export type ReconciliationStatus =
  | "unmatched"
  | "matched"
  | "disputed"
  | "ignored";

export type ReconciliationProvider =
  | "paystack"
  | "hubtel"
  | "mtn_momo"
  | "bank"
  | "manual";

export type PartyType =
  | "student"
  | "guardian"
  | "vendor"
  | "staff"
  | "donor"
  | "other";

export type ApprovalStatus = "pending" | "approved" | "rejected";

// ========================
// Interfaces
// ========================

export interface ITransactionParty {
  type: PartyType;
  id?: Types.ObjectId | null;
  name: string;
  contact?: {
    phone?: string | null;
    email?: string | null;
  };
}

export interface ITransactionAttachment {
  url: string;
  type: "image" | "pdf";
  name?: string | null;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId | null;
}

export interface ITransactionReconciliation {
  status: ReconciliationStatus;
  provider?: ReconciliationProvider | null;
  providerReference?: string | null;
  settlementBatchId?: string | null;
  matchedAt?: Date | null;
  matchedBy?: Types.ObjectId | null;
}

export interface ITransactionApproval {
  required: boolean;
  status: ApprovalStatus;
  requestedBy?: Types.ObjectId | null;
  requestedAt?: Date | null;
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
  reason?: string | null;
}

export interface IFinancialTransaction {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  // Core transaction fields
  direction: TransactionDirection;
  status: TransactionStatus;
  grossAmountMinor: number;
  feeAmountMinor: number;
  netAmountMinor: number;
  currency: string;
  occurredAt: Date;

  // Categorization
  category: TransactionCategory;
  sourceModule: TransactionSourceModule;
  sourceId?: Types.ObjectId | string | null;
  method: TransactionMethod;
  channel?: TransactionChannel | null;

  // Reference and description
  reference?: string | null;
  description?: string | null;
  tags?: string[];
  notes?: string | null;
  batchId?: Types.ObjectId | null;

  // Party (who paid or received)
  party?: ITransactionParty | null;

  // Academic linkage
  academicPeriodId?: Types.ObjectId | null;
  dayKey?: string | null; // YYYY-MM-DD
  monthKey?: string | null; // YYYY-MM

  // Correction links
  originalTransactionId?: Types.ObjectId | null;
  correctedById?: Types.ObjectId | null;

  // Attachments and meta
  attachments?: ITransactionAttachment[];
  meta?: Record<string, unknown>;

  // Reconciliation
  reconciliation?: ITransactionReconciliation | null;

  // Approval workflow (for manual entries)
  approval?: ITransactionApproval | null;

  // Void info
  voidedAt?: Date | null;
  voidedBy?: Types.ObjectId | null;
  voidReason?: string | null;

  // Audit integrity
  createdBy?: Types.ObjectId | null;
  finalizedAt?: Date | null;
  finalizedReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ========================
// Schema
// ========================

const financialTransactionSchema = new Schema<IFinancialTransaction>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    // Core transaction fields
    direction: {
      type: String,
      enum: ["inflow", "outflow"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "success",
        "failed",
        "refunded",
        "reversed",
        "voided",
        "disputed",
        "held",
      ],
      default: "pending",
      required: true,
    },
    grossAmountMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    feeAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmountMinor: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "GHS",
      required: true,
      uppercase: true,
      trim: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Categorization
    category: {
      type: String,
      enum: [
        "fees",
        "store",
        "fundraising",
        "expenses",
        "other_income",
        "refund",
        "adjustment",
        "gateway_fee",
        "bank_charge",
        "penalty",
        "discount",
      ],
      required: true,
    },
    sourceModule: {
      type: String,
      enum: ["fees", "store", "community", "fundraising", "expenses", "manual"],
      required: true,
    },
    sourceId: {
      type: Schema.Types.Mixed, // ObjectId or String
      default: null,
    },
    method: {
      type: String,
      enum: ["cash", "mobile_money", "bank_transfer", "card", "cheque", "other"],
      required: true,
    },
    channel: {
      type: String,
      enum: ["in_app", "web", "mobile", "pos", "offline"],
      default: null,
    },

    // Reference and description
    reference: {
      type: String,
      default: null,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    tags: [{ type: String, trim: true }],
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    // Party
    party: {
      type: {
        type: String,
        enum: ["student", "guardian", "vendor", "staff", "donor", "other"],
      },
      id: {
        type: Schema.Types.ObjectId,
        default: null,
      },
      name: {
        type: String,
        trim: true,
      },
      contact: {
        phone: { type: String, default: null, trim: true },
        email: { type: String, default: null, trim: true, lowercase: true },
      },
    },

    // Academic linkage
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
    },
    dayKey: {
      type: String,
      default: null,
      index: true,
    },
    monthKey: {
      type: String,
      default: null,
      index: true,
    },

    // Correction links
    originalTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "FinancialTransaction",
      default: null,
    },
    correctedById: {
      type: Schema.Types.ObjectId,
      ref: "FinancialTransaction",
      default: null,
    },

    // Attachments
    attachments: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "pdf"], required: true },
        name: { type: String, default: null, trim: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      },
    ],
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Reconciliation
    reconciliation: {
      status: {
        type: String,
        enum: ["unmatched", "matched", "disputed", "ignored"],
        default: "unmatched",
      },
      provider: {
        type: String,
        enum: ["paystack", "hubtel", "mtn_momo", "bank", "manual"],
        default: null,
      },
      providerReference: { type: String, default: null, trim: true },
      settlementBatchId: { type: String, default: null, trim: true },
      matchedAt: { type: Date, default: null },
      matchedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },

    // Approval workflow
    approval: {
      required: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      requestedAt: { type: Date, default: null },
      decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      decidedAt: { type: Date, default: null },
      reason: { type: String, default: null, trim: true },
    },

    // Void info
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: null, trim: true },

    // Audit integrity
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    finalizedAt: { type: Date, default: null },
    finalizedReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// ========================
// Pre-save hook for derived fields
// ========================

financialTransactionSchema.pre("save", function (next) {
  // Derive dayKey and monthKey from occurredAt
  if (this.occurredAt) {
    const date = new Date(this.occurredAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    this.dayKey = `${year}-${month}-${day}`;
    this.monthKey = `${year}-${month}`;
  }
  next();
});

// ========================
// Indexes
// ========================

// Primary query indexes
financialTransactionSchema.index({ schoolId: 1, occurredAt: -1 });
financialTransactionSchema.index({ schoolId: 1, status: 1, occurredAt: -1 });
financialTransactionSchema.index({ schoolId: 1, category: 1, occurredAt: -1 });
financialTransactionSchema.index({ schoolId: 1, direction: 1, occurredAt: -1 });

// Source module lookup (prevent duplicates)
financialTransactionSchema.index(
  { schoolId: 1, sourceModule: 1, sourceId: 1 },
  { unique: true, sparse: true }
);

// Reconciliation queries
financialTransactionSchema.index({
  schoolId: 1,
  "reconciliation.status": 1,
  occurredAt: -1,
});

// Party lookups
financialTransactionSchema.index({ schoolId: 1, "party.id": 1 }, { sparse: true });

// Batch operations
financialTransactionSchema.index({ schoolId: 1, batchId: 1 }, { sparse: true });

// Approval workflow
financialTransactionSchema.index(
  { schoolId: 1, "approval.status": 1 },
  { sparse: true }
);

// Academic period
financialTransactionSchema.index({ schoolId: 1, academicPeriodId: 1 }, { sparse: true });

// Method queries
financialTransactionSchema.index({ schoolId: 1, method: 1, occurredAt: -1 });

// ========================
// Export
// ========================

export const FinancialTransaction =
  models.FinancialTransaction ||
  model<IFinancialTransaction>("FinancialTransaction", financialTransactionSchema);
