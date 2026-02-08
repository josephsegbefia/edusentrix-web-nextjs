// src/app/api/admin/expenses/route.ts
// List and create expenses

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense, ExpenseStatus } from "@/models/SchoolExpense";

// GET /api/admin/expenses
// List all expenses with filters and pagination
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100
    );
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status");
    const categoryId = searchParams.get("categoryId");
    const vendorId = searchParams.get("vendorId");
    const method = searchParams.get("method");
    const costCenter = searchParams.get("costCenter");
    const academicPeriodId = searchParams.get("academicPeriodId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("q");

    // Build query
    const query: Record<string, unknown> = { schoolId };

    if (status) {
      const statuses = status.split(",") as ExpenseStatus[];
      query.status = { $in: statuses };
    }
    if (categoryId) query.categoryId = new Types.ObjectId(categoryId);
    if (vendorId) query.vendorId = new Types.ObjectId(vendorId);
    if (method) query.paymentMethod = method;
    if (costCenter) query.costCenter = costCenter;
    if (academicPeriodId)
      query.academicPeriodId = new Types.ObjectId(academicPeriodId);

    if (dateFrom || dateTo) {
      query.expenseDate = {};
      if (dateFrom) {
        (query.expenseDate as Record<string, Date>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        (query.expenseDate as Record<string, Date>).$lte = new Date(dateTo);
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { expenseNumber: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    const sortBy = searchParams.get("sortBy") || "expenseDate";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const [expenses, total] = await Promise.all([
      SchoolExpense.find(query)
        .populate("categoryId", "name code")
        .populate("vendorId", "name")
        .populate("createdBy", "name email")
        .populate("approvedBy", "name")
        .populate("paidBy", "name")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      SchoolExpense.countDocuments(query),
    ]);

    return NextResponse.json({
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// POST /api/admin/expenses
// Create a new expense (as draft)
export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

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

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Expense title is required" },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Expense category is required" },
        { status: 400 }
      );
    }

    if (!amountMinor || typeof amountMinor !== "number" || amountMinor <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Generate expense number
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    interface ExpenseNumberLean {
      expenseNumber: string;
    }
    const lastExpense = await SchoolExpense.findOne({
      schoolId,
      expenseNumber: { $regex: `^${prefix}` },
    })
      .sort({ expenseNumber: -1 })
      .select("expenseNumber")
      .lean() as ExpenseNumberLean | null;

    let nextNumber = 1;
    if (lastExpense?.expenseNumber) {
      const lastNum = parseInt(
        lastExpense.expenseNumber.replace(prefix, ""),
        10
      );
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }
    const expenseNumber = `${prefix}${String(nextNumber).padStart(5, "0")}`;

    const expense = await SchoolExpense.create({
      schoolId,
      expenseNumber,
      status: "draft",
      title: title.trim(),
      description: description?.trim() || null,
      categoryId: new Types.ObjectId(categoryId),
      vendorId: vendorId ? new Types.ObjectId(vendorId) : null,
      amountMinor,
      currency: currency || "GHS",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      costCenter: costCenter || null,
      academicPeriodId: academicPeriodId
        ? new Types.ObjectId(academicPeriodId)
        : null,
      receipts: receipts || [],
      notes: notes?.trim() || null,
      tags: tags || [],
      createdBy: userId,
    });

    // Populate for response
    await expense.populate([
      { path: "categoryId", select: "name code" },
      { path: "vendorId", select: "name" },
      { path: "createdBy", select: "name email" },
    ]);

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
