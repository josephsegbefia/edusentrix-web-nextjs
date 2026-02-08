// src/app/api/admin/finance/transactions/[id]/approve/route.ts
// Approve or reject pending manual transactions

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FinancialTransaction } from "@/models/FinancialTransaction";
import { recordActivity } from "@/lib/audit/recordActivity";

// ========================
// Types
// ========================

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TransactionLean {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  status: string;
  direction: string;
  category: string;
  grossAmountMinor: number;
  currency: string;
  description?: string | null;
  createdBy?: mongoose.Types.ObjectId | null;
  approval?: {
    required: boolean;
    status: string;
    requestedBy?: mongoose.Types.ObjectId;
    requestedAt?: Date;
    decidedBy?: mongoose.Types.ObjectId;
    decidedAt?: Date;
    reason?: string;
  } | null;
  meta?: Record<string, unknown>;
}

function objectIdEquals(
  left?: mongoose.Types.ObjectId | null,
  right?: mongoose.Types.ObjectId | null
): boolean {
  if (!left || !right) return false;
  return String(left) === String(right);
}

// ========================
// Validation
// ========================

const ApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().max(500).optional(),
});

// ========================
// POST Handler
// ========================

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const result = ApprovalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { action, reviewNotes } = result.data;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const transactionIdObj = new mongoose.Types.ObjectId(id);

    // Find the transaction
    const transaction = await FinancialTransaction.findOne({
      _id: transactionIdObj,
      schoolId: schoolIdObj,
    }).lean() as TransactionLean | null;

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify it's a pending manual transaction
    if (transaction.status !== "pending") {
      return NextResponse.json(
        { error: "Transaction is not pending approval" },
        { status: 400 }
      );
    }

    if (!transaction.approval?.required) {
      return NextResponse.json(
        { error: "Transaction does not require approval" },
        { status: 400 }
      );
    }

    if (transaction.approval.status !== "pending") {
      return NextResponse.json(
        { error: `Transaction already ${transaction.approval.status}` },
        { status: 400 }
      );
    }

    // Maker-checker: requester/creator cannot approve their own manual transaction.
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    if (
      objectIdEquals(transaction.approval.requestedBy || null, userIdObj) ||
      objectIdEquals(transaction.createdBy || null, userIdObj)
    ) {
      return NextResponse.json(
        {
          error:
            "Dual-control policy violation: a different finance user must approve this transaction.",
          code: "maker_checker_required",
        },
        { status: 409 }
      );
    }

    // Update transaction
    const updateData: Record<string, unknown> = {
      "approval.status": action === "approve" ? "approved" : "rejected",
      "approval.decidedBy": userIdObj,
      "approval.decidedAt": new Date(),
      "approval.reason": reviewNotes || null,
      updatedAt: new Date(),
    };

    if (action === "approve") {
      updateData.status = "success";
      updateData.finalizedAt = new Date();
      updateData.finalizedReason = "manual_entry_approved";
    } else {
      updateData.status = "failed";
      updateData.finalizedAt = new Date();
      updateData.finalizedReason = "manual_entry_rejected";
    }

    await FinancialTransaction.updateOne(
      { _id: transactionIdObj },
      { $set: updateData }
    );

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: action === "approve" ? "transaction.created" : "transaction.voided",
      entityType: "financial_transaction",
      entityId: id,
      description: `${action === "approve" ? "Approved" : "Rejected"} manual transaction: ${(transaction.grossAmountMinor / 100).toFixed(2)} ${transaction.currency}`,
      metadata: {
        transactionId: id,
        action,
        direction: transaction.direction,
        category: transaction.category,
        amountMinor: transaction.grossAmountMinor,
        reviewNotes,
      },
    });

    return NextResponse.json({
      success: true,
      action,
      message:
        action === "approve"
          ? "Transaction approved successfully"
          : "Transaction rejected",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error processing transaction approval:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
