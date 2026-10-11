// src/app/api/admin/expenses/[id]/reject/route.ts
// Reject submitted expense

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";
import {
  APPROVAL_CONTRACT_VERSION,
  decisionError,
  parseObjectId,
  readJsonObject,
  toObjectId,
  withDecisionErrors,
} from "@/lib/approvals/decision-guard";
import { decideExpense, EXPENSE_NOTE_MAX } from "@/lib/finance/expense-decisions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/expenses/:id/reject
// Body: { reason: string } — required, ≤ 500. The expense's creator or submitter cannot reject it.
export async function POST(req: NextRequest, { params }: RouteParams) {
  return withDecisionErrors(async () => {
    const { userId, schoolId } = await requireFinanceStaff();
    const { id } = await params;
    const expenseId = parseObjectId(id);
    if (!expenseId) {
      return decisionError("invalid_id", "Invalid expense id");
    }

    const body = await readJsonObject(req);
    if (!body) {
      return decisionError("invalid_body", "Send a JSON object with a rejection reason.");
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return decisionError("reason_required", "Rejection reason is required");
    }
    if (reason.length > EXPENSE_NOTE_MAX) {
      return decisionError("invalid_body", `Keep the reason under ${EXPENSE_NOTE_MAX} characters.`);
    }

    await connectToDatabase();
    const result = await decideExpense({
      expenseId,
      schoolId: toObjectId(schoolId),
      actorUserId: userId,
      action: "reject",
      text: reason,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return decisionError("not_found", "Expense not found");
      }
      if (result.reason === "maker_checker") {
        return decisionError(
          "maker_checker_required",
          "You created or submitted this expense, so another authorized person must decide it."
        );
      }
      return decisionError("stale_decision", "Only submitted expenses can be rejected.", {
        data: { status: result.status },
      });
    }

    const expense = await SchoolExpense.findById(result.expenseId)
      .populate([
        { path: "categoryId", select: "name code" },
        { path: "vendorId", select: "name" },
        { path: "createdBy", select: "name email" },
        { path: "rejectedBy", select: "name email" },
      ])
      .lean();

    return NextResponse.json({
      contractVersion: APPROVAL_CONTRACT_VERSION,
      message: "Expense rejected",
      data: expense,
    });
  }, "Failed to reject expense");
}
