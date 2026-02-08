// src/app/api/admin/expenses/[id]/submit/route.ts
// Submit expense for approval

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/expenses/:id/submit
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    const { id } = await params;
    await connectToDatabase();

    const expense = await SchoolExpense.findOne({
      _id: id,
      schoolId,
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if expense can be submitted
    if (!["draft", "rejected"].includes(expense.status)) {
      return NextResponse.json(
        { error: "Only draft or rejected expenses can be submitted" },
        { status: 400 }
      );
    }

    // Update status
    expense.status = "submitted";
    expense.submittedAt = new Date();
    expense.submittedBy = userId;

    // Clear rejection fields if resubmitting
    if (expense.rejectedAt) {
      expense.rejectedAt = null;
      expense.rejectedBy = null;
      expense.rejectionReason = null;
    }

    await expense.save();

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "expense.submitted",
      description: `Submitted expense ${expense.expenseNumber} for approval`,
      metadata: {
        expenseId: expense._id,
        expenseNumber: expense.expenseNumber,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
      },
    });

    // Populate for response
    await expense.populate([
      { path: "categoryId", select: "name code" },
      { path: "vendorId", select: "name" },
      { path: "createdBy", select: "name email" },
      { path: "submittedBy", select: "name email" },
    ]);

    return NextResponse.json({
      message: "Expense submitted for approval",
      data: expense,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error submitting expense:", error);
    return NextResponse.json(
      { error: "Failed to submit expense" },
      { status: 500 }
    );
  }
}
