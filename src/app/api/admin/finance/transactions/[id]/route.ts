// src/app/api/admin/finance/transactions/[id]/route.ts
// Single transaction detail API

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FinancialTransaction } from "@/models/FinancialTransaction";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const DUAL_CONTROL_THRESHOLD_MINOR = (() => {
  const parsed = Number.parseInt(
    process.env.RECONCILIATION_DUAL_CONTROL_THRESHOLD_MINOR || "",
    10
  );
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 1_000_000; // GHS 10,000 default
})();

function normalizeObjectId(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return normalizeObjectId((value as { _id?: unknown })._id);
  }
  return null;
}

function objectIdEquals(left: unknown, right: unknown) {
  const leftId = normalizeObjectId(left);
  const rightId = normalizeObjectId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

// GET /api/admin/finance/transactions/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    const { id } = await params;
    await connectToDatabase();

    interface TransactionLean {
      _id: mongoose.Types.ObjectId;
      originalTransactionId?: mongoose.Types.ObjectId | null;
      correctedById?: mongoose.Types.ObjectId | null;
      category?: string;
      sourceModule?: string;
      grossAmountMinor?: number;
      createdBy?: unknown;
      approval?: {
        requestedBy?: unknown;
      } | null;
      [key: string]: unknown;
    }

    const transaction = await FinancialTransaction.findOne({
      _id: id,
      schoolId,
    })
      .populate("createdBy", "name email")
      .populate("academicPeriodId", "name term yearLabel startDate endDate")
      .populate("originalTransactionId")
      .populate("correctedById")
      .lean() as TransactionLean | null;

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // If this is a correction, get the original transaction
    let originalTransaction = null;
    if (transaction.originalTransactionId) {
      originalTransaction = await FinancialTransaction.findById(
        transaction.originalTransactionId
      )
        .select("reference grossAmountMinor currency occurredAt status")
        .lean();
    }

    // If this transaction was corrected, get the correction
    let correctionTransaction = null;
    if (transaction.correctedById) {
      correctionTransaction = await FinancialTransaction.findById(
        transaction.correctedById
      )
        .select("reference grossAmountMinor currency occurredAt status category")
        .lean();
    }

    const dualControlTriggers: string[] = [];
    if (transaction.sourceModule === "manual") {
      dualControlTriggers.push("manual_entry");
    }
    if (
      typeof transaction.grossAmountMinor === "number" &&
      transaction.grossAmountMinor >= DUAL_CONTROL_THRESHOLD_MINOR
    ) {
      dualControlTriggers.push("high_value");
    }
    if (
      transaction.category === "refund" ||
      transaction.category === "adjustment"
    ) {
      dualControlTriggers.push("sensitive_category");
    }
    const dualControlRequired = dualControlTriggers.length > 0;
    const actorConflict =
      dualControlRequired &&
      (objectIdEquals(transaction.createdBy, userId) ||
        objectIdEquals(transaction.approval?.requestedBy, userId));

    return NextResponse.json({
      data: {
        ...transaction,
        _original: originalTransaction,
        _correction: correctionTransaction,
        policy: {
          dualControl: {
            required: dualControlRequired,
            triggers: dualControlTriggers,
            thresholdMinor: DUAL_CONTROL_THRESHOLD_MINOR,
            actorConflict,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/finance/transactions/:id
// Only allows adding notes or attachments to non-finalized transactions
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    const { id } = await params;
    await connectToDatabase();

    const transaction = await FinancialTransaction.findOne({
      _id: id,
      schoolId,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Only allow editing notes and attachments
    const body = await req.json();
    const { notes, attachments } = body;

    if (notes !== undefined) {
      transaction.notes = notes?.trim() || null;
    }

    if (attachments !== undefined && Array.isArray(attachments)) {
      // Add new attachments
      transaction.attachments = attachments.map((att) => ({
        url: att.url,
        type: att.type || "image",
        name: att.name || null,
        uploadedAt: new Date(),
        uploadedBy: userId,
      }));
    }

    await transaction.save();

    return NextResponse.json({ data: transaction });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
