// src/lib/finance/writeLedgerEntry.ts
// Utility to write transactions to the Financial Center ledger

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  FinancialTransaction,
  TransactionDirection,
  TransactionStatus,
  TransactionCategory,
  TransactionSourceModule,
  TransactionMethod,
  TransactionChannel,
} from "@/models/FinancialTransaction";

// ========================
// Types
// ========================

export interface LedgerParty {
  type: "student" | "guardian" | "vendor" | "staff" | "donor" | "other";
  id?: string | null;
  name: string;
  contact?: {
    phone?: string | null;
    email?: string | null;
  };
}

export interface LedgerAttachment {
  url: string;
  type: "image" | "pdf";
  name?: string | null;
}

export interface LedgerEntryInput {
  schoolId: string | Types.ObjectId;
  direction: TransactionDirection;
  status?: TransactionStatus;
  grossAmountMinor: number;
  feeAmountMinor?: number;
  currency?: string;
  occurredAt?: Date;
  category: TransactionCategory;
  sourceModule: TransactionSourceModule;
  sourceId?: string | Types.ObjectId | null;
  method: TransactionMethod;
  channel?: TransactionChannel;
  reference?: string | null;
  description?: string | null;
  tags?: string[];
  notes?: string | null;
  party?: LedgerParty | null;
  academicPeriodId?: string | Types.ObjectId | null;
  attachments?: LedgerAttachment[];
  meta?: Record<string, unknown>;
  createdBy?: string | Types.ObjectId | null;
  finalizedAt?: Date | null;
  finalizedReason?: string | null;
}

export interface LedgerEntryResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// ========================
// Main Function
// ========================

/**
 * Write a transaction entry to the Financial Center ledger.
 * Uses idempotency via (schoolId, sourceModule, sourceId) unique index.
 * 
 * @param input - The transaction details
 * @returns Result with transaction ID or error
 */
export async function writeLedgerEntry(
  input: LedgerEntryInput
): Promise<LedgerEntryResult> {
  try {
    await connectToDatabase();

    const schoolIdObj =
      typeof input.schoolId === "string"
        ? new Types.ObjectId(input.schoolId)
        : input.schoolId;

    // Check for duplicate (idempotency)
    if (input.sourceId) {
      const existing = await FinancialTransaction.findOne({
        schoolId: schoolIdObj,
        sourceModule: input.sourceModule,
        sourceId: input.sourceId,
      }).select("_id");

      if (existing) {
        // Already exists - return existing ID (idempotent)
        return {
          success: true,
          transactionId: String(existing._id),
        };
      }
    }

    // Calculate net amount
    const feeAmountMinor = input.feeAmountMinor || 0;
    const netAmountMinor =
      input.direction === "inflow"
        ? input.grossAmountMinor - feeAmountMinor
        : input.grossAmountMinor;

    // Create the transaction
    const transaction = await FinancialTransaction.create({
      schoolId: schoolIdObj,
      direction: input.direction,
      status: input.status || "success",
      grossAmountMinor: input.grossAmountMinor,
      feeAmountMinor,
      netAmountMinor,
      currency: input.currency || "GHS",
      occurredAt: input.occurredAt || new Date(),
      category: input.category,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId || null,
      method: input.method,
      channel: input.channel || "in_app",
      reference: input.reference || null,
      description: input.description || null,
      tags: input.tags || [],
      notes: input.notes || null,
      party: input.party || null,
      academicPeriodId: input.academicPeriodId
        ? new Types.ObjectId(String(input.academicPeriodId))
        : null,
      attachments: (input.attachments || []).map((att) => ({
        ...att,
        uploadedAt: new Date(),
        uploadedBy: input.createdBy || null,
      })),
      meta: input.meta || {},
      reconciliation: {
        status: "unmatched",
        provider: null,
      },
      createdBy: input.createdBy
        ? new Types.ObjectId(String(input.createdBy))
        : null,
      finalizedAt: input.finalizedAt || new Date(),
      finalizedReason: input.finalizedReason || null,
    });

    return {
      success: true,
      transactionId: String(transaction._id),
    };
  } catch (error) {
    console.error("Error writing ledger entry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ========================
// Convenience Functions
// ========================

/**
 * Record a fee payment in the ledger
 */
export async function recordFeePaymentInLedger(params: {
  schoolId: string;
  paymentId: string;
  amountMinor: number;
  feeAmountMinor?: number;
  currency?: string;
  paymentMethod: string;
  paymentReference?: string | null;
  studentId?: string | null;
  studentName?: string;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  invoiceNumber?: string | null;
  description?: string | null;
  academicPeriodId?: string | null;
  occurredAt?: Date;
  createdBy?: string | null;
}): Promise<LedgerEntryResult> {
  const methodMap: Record<string, TransactionMethod> = {
    cash: "cash",
    bank_transfer: "bank_transfer",
    mobile_money: "mobile_money",
    paystack: "card",
    cheque: "cheque",
    other: "other",
  };

  return writeLedgerEntry({
    schoolId: params.schoolId,
    direction: "inflow",
    status: "success",
    grossAmountMinor: params.amountMinor,
    feeAmountMinor: params.feeAmountMinor || 0,
    currency: params.currency || "GHS",
    occurredAt: params.occurredAt || new Date(),
    category: "fees",
    sourceModule: "fees",
    sourceId: params.paymentId,
    method: methodMap[params.paymentMethod] || "other",
    channel: params.paymentMethod === "paystack" ? "web" : "in_app",
    reference: params.paymentReference || params.invoiceNumber || null,
    description:
      params.description ||
      `Fee payment${params.invoiceNumber ? ` for ${params.invoiceNumber}` : ""}`,
    party: params.studentName
      ? {
          type: "student",
          id: params.studentId || null,
          name: params.studentName,
          contact: {
            email: params.guardianEmail || null,
            phone: params.guardianPhone || null,
          },
        }
      : null,
    academicPeriodId: params.academicPeriodId || null,
    meta: {
      invoiceNumber: params.invoiceNumber,
      guardianName: params.guardianName,
    },
    createdBy: params.createdBy || null,
    finalizedAt: new Date(),
    finalizedReason: "fee_payment_completed",
  });
}

/**
 * Record a fundraising donation in the ledger
 */
export async function recordDonationInLedger(params: {
  schoolId: string;
  donationId: string;
  campaignId: string;
  campaignTitle: string;
  amountMinor: number;
  feeAmountMinor?: number;
  currency?: string;
  paymentMethod: string;
  gatewayReference?: string | null;
  donorName: string;
  donorEmail?: string | null;
  donorPhone?: string | null;
  isAnonymous?: boolean;
  receiptNumber?: string | null;
  occurredAt?: Date;
  createdBy?: string | null;
}): Promise<LedgerEntryResult> {
  const methodMap: Record<string, TransactionMethod> = {
    cash: "cash",
    bank_transfer: "bank_transfer",
    mobile_money: "mobile_money",
    paystack: "card",
    stripe: "card",
    cheque: "cheque",
    other: "other",
  };

  return writeLedgerEntry({
    schoolId: params.schoolId,
    direction: "inflow",
    status: "success",
    grossAmountMinor: params.amountMinor,
    feeAmountMinor: params.feeAmountMinor || 0,
    currency: params.currency || "GHS",
    occurredAt: params.occurredAt || new Date(),
    category: "fundraising",
    sourceModule: "fundraising",
    sourceId: params.donationId,
    method: methodMap[params.paymentMethod] || "other",
    channel:
      params.paymentMethod === "paystack" || params.paymentMethod === "stripe"
        ? "web"
        : "in_app",
    reference: params.gatewayReference || params.receiptNumber || null,
    description: `Donation for ${params.campaignTitle}`,
    party: {
      type: "donor",
      id: null,
      name: params.isAnonymous ? "Anonymous Donor" : params.donorName,
      contact: params.isAnonymous
        ? undefined
        : {
            email: params.donorEmail || null,
            phone: params.donorPhone || null,
          },
    },
    meta: {
      campaignId: params.campaignId,
      campaignTitle: params.campaignTitle,
      receiptNumber: params.receiptNumber,
      isAnonymous: params.isAnonymous,
    },
    createdBy: params.createdBy || null,
    finalizedAt: new Date(),
    finalizedReason: "donation_completed",
  });
}

/**
 * Record a school store / marketplace sale (parent Paystack checkout) in the ledger.
 */
export async function recordStoreSaleInLedger(params: {
  schoolId: string;
  storeOrderId: string;
  amountMinor: number;
  feeAmountMinor?: number;
  currency?: string;
  paymentMethod: string;
  gatewayReference?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  studentName?: string | null;
  studentId?: string | null;
  lineSummary?: string | null;
  occurredAt?: Date;
  createdBy?: string | null;
}): Promise<LedgerEntryResult> {
  const methodMap: Record<string, TransactionMethod> = {
    cash: "cash",
    bank_transfer: "bank_transfer",
    mobile_money: "mobile_money",
    paystack: "card",
    cheque: "cheque",
    other: "other",
  };

  return writeLedgerEntry({
    schoolId: params.schoolId,
    direction: "inflow",
    status: "success",
    grossAmountMinor: params.amountMinor,
    feeAmountMinor: params.feeAmountMinor || 0,
    currency: params.currency || "GHS",
    occurredAt: params.occurredAt || new Date(),
    category: "store",
    sourceModule: "store",
    sourceId: params.storeOrderId,
    method: methodMap[params.paymentMethod] || "other",
    channel: params.paymentMethod === "paystack" ? "web" : "in_app",
    reference: params.gatewayReference || null,
    description:
      params.lineSummary ||
      `Store purchase${params.studentName ? ` (${params.studentName})` : ""}`,
    party: {
      type: "guardian",
      id: null,
      name: params.parentName || params.parentEmail || "Parent",
      contact: {
        email: params.parentEmail || null,
        phone: null,
      },
    },
    meta: {
      studentId: params.studentId,
      studentName: params.studentName,
    },
    createdBy: params.createdBy || null,
    finalizedAt: new Date(),
    finalizedReason: "store_order_paid",
  });
}
