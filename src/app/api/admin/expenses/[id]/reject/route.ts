// src/app/api/admin/expenses/[id]/reject/route.ts
// Reject submitted expense

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/expenses/:id/reject
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const expense = await SchoolExpense.findOne({
      _id: id,
      schoolId,
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if expense can be rejected
    if (expense.status !== "submitted") {
      return NextResponse.json(
        { error: "Only submitted expenses can be rejected" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Update status
    expense.status = "rejected";
    expense.rejectedAt = new Date();
    expense.rejectedBy = userId;
    expense.rejectionReason = reason.trim();

    await expense.save();

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "expense.rejected",
      description: `Rejected expense ${expense.expenseNumber}: ${reason.trim()}`,
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
      { path: "rejectedBy", select: "name email" },
    ]);

    return NextResponse.json({
      message: "Expense rejected",
      data: expense,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error rejecting expense:", error);
    return NextResponse.json(
      { error: "Failed to reject expense" },
      { status: 500 }
    );
  }
}
