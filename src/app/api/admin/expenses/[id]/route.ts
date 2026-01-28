// src/app/api/admin/expenses/[id]/route.ts
// Get and update individual expense

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense } from "@/models/SchoolExpense";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/expenses/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const expense = await SchoolExpense.findOne({
      _id: id,
      schoolId,
    })
      .populate("categoryId", "name code description")
      .populate("vendorId", "name phone email address")
      .populate("createdBy", "name email")
      .populate("submittedBy", "name email")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email")
      .populate("paidBy", "name email")
      .populate("cancelledBy", "name email")
      .populate("academicPeriodId", "name startDate endDate")
      .lean();

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ data: expense });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/expenses/:id
// Update expense (only allowed for draft or rejected status)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const expense = await SchoolExpense.findOne({
      _id: id,
      schoolId,
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if expense is editable
    if (!["draft", "rejected"].includes(expense.status)) {
      return NextResponse.json(
        { error: "Only draft or rejected expenses can be edited" },
        { status: 400 }
      );
    }

    // Check if locked
    if (expense.lockedAt) {
      return NextResponse.json(
        { error: "This expense is locked and cannot be edited" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      categoryId,
      vendorId,
      amountMinor,
      currency,
      expenseDate,
      costCenter,
      academicPeriodId,
      receipts,
      notes,
      tags,
    } = body;

    // Update fields
    if (title !== undefined) {
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Expense title cannot be empty" },
          { status: 400 }
        );
      }
      expense.title = title.trim();
    }

    if (description !== undefined) {
      expense.description = description?.trim() || null;
    }

    if (categoryId !== undefined) {
      if (!categoryId) {
        return NextResponse.json(
          { error: "Expense category is required" },
          { status: 400 }
        );
      }
      expense.categoryId = new Types.ObjectId(categoryId);
    }

    if (vendorId !== undefined) {
      expense.vendorId = vendorId ? new Types.ObjectId(vendorId) : null;
    }

    if (amountMinor !== undefined) {
      if (typeof amountMinor !== "number" || amountMinor <= 0) {
        return NextResponse.json(
          { error: "Valid amount is required" },
          { status: 400 }
        );
      }
      expense.amountMinor = amountMinor;
    }

    if (currency !== undefined) expense.currency = currency || "GHS";
    if (expenseDate !== undefined)
      expense.expenseDate = expenseDate ? new Date(expenseDate) : new Date();
    if (costCenter !== undefined) expense.costCenter = costCenter || null;
    if (academicPeriodId !== undefined) {
      expense.academicPeriodId = academicPeriodId
        ? new Types.ObjectId(academicPeriodId)
        : null;
    }
    if (receipts !== undefined) expense.receipts = receipts || [];
    if (notes !== undefined) expense.notes = notes?.trim() || null;
    if (tags !== undefined) expense.tags = tags || [];

    await expense.save();

    // Populate for response
    await expense.populate([
      { path: "categoryId", select: "name code" },
      { path: "vendorId", select: "name" },
      { path: "createdBy", select: "name email" },
    ]);

    return NextResponse.json({ data: expense });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}
