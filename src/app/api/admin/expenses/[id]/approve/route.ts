// src/app/api/admin/expenses/[id]/approve/route.ts
// Approve submitted expense

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/expenses/:id/approve
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

    // Check if expense can be approved
    if (expense.status !== "submitted") {
      return NextResponse.json(
        { error: "Only submitted expenses can be approved" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { note } = body;

    // Update status
    expense.status = "approved";
    expense.approvedAt = new Date();
    expense.approvedBy = userId;
    expense.approvalNote = note?.trim() || null;
    expense.lockedAt = new Date();
    expense.lockReason = "approved";

    await expense.save();

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "expense.approved",
      description: `Approved expense ${expense.expenseNumber}`,
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
      { path: "approvedBy", select: "name email" },
    ]);

    return NextResponse.json({
      message: "Expense approved",
      data: expense,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error approving expense:", error);
    return NextResponse.json(
      { error: "Failed to approve expense" },
      { status: 500 }
    );
  }
}
