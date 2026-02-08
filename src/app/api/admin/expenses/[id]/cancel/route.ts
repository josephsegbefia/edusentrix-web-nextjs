// src/app/api/admin/expenses/[id]/cancel/route.ts
// Cancel an expense

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/expenses/:id/cancel
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

    // Check if expense can be cancelled
    const cancellableStatuses = ["draft", "submitted", "rejected"];
    if (!cancellableStatuses.includes(expense.status)) {
      return NextResponse.json(
        {
          error:
            "Only draft, submitted, or rejected expenses can be cancelled",
        },
        { status: 400 }
      );
    }

    // Check if locked
    if (expense.lockedAt) {
      return NextResponse.json(
        { error: "This expense is locked and cannot be cancelled" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Cancellation reason is required" },
        { status: 400 }
      );
    }

    // Update status
    expense.status = "cancelled";
    expense.cancelledAt = new Date();
    expense.cancelledBy = userId;
    expense.cancellationReason = reason.trim();

    await expense.save();

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "expense.cancelled",
      description: `Cancelled expense ${expense.expenseNumber}: ${reason.trim()}`,
      metadata: {
        expenseId: expense._id,
        expenseNumber: expense.expenseNumber,
        reason: reason.trim(),
      },
    });

    // Populate for response
    await expense.populate([
      { path: "categoryId", select: "name code" },
      { path: "vendorId", select: "name" },
      { path: "createdBy", select: "name email" },
      { path: "cancelledBy", select: "name email" },
    ]);

    return NextResponse.json({
      message: "Expense cancelled",
      data: expense,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error cancelling expense:", error);
    return NextResponse.json(
      { error: "Failed to cancel expense" },
      { status: 500 }
    );
  }
}
