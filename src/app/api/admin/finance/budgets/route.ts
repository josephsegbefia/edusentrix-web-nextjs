// src/app/api/admin/finance/budgets/route.ts
// Budget list and create API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Budget, IBudget, BudgetPeriodType } from "@/models/Budget";
import { ExpenseCategory } from "@/models/ExpenseCategory";

// ========================
// Types
// ========================

interface BudgetLean {
  _id: mongoose.Types.ObjectId;
  name: string;
  periodType: BudgetPeriodType;
  startDate: Date;
  endDate: Date;
  academicPeriodId?: mongoose.Types.ObjectId | null;
  currency: string;
  totalBudgetedMinor: number;
  lineItems: Array<{
    categoryId: mongoose.Types.ObjectId;
    categoryName: string;
    budgetedAmountMinor: number;
    notes?: string | null;
  }>;
  status: string;
  notes?: string | null;
  createdBy: mongoose.Types.ObjectId | { firstName?: string; lastName?: string };
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// GET Handler
// ========================

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void Budget.modelName;

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const academicPeriodId = searchParams.get("academicPeriodId");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Build query
    const query: Record<string, unknown> = {
      schoolId: schoolIdObj,
    };

    if (status && status !== "all") {
      query.status = status;
    }

    if (academicPeriodId) {
      query.academicPeriodId = new mongoose.Types.ObjectId(academicPeriodId);
    }

    // Fetch budgets
    const [budgets, total] = await Promise.all([
      Budget.find(query)
        .sort({ startDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "firstName lastName")
        .populate("academicPeriodId", "yearLabel term")
        .lean() as Promise<BudgetLean[]>,
      Budget.countDocuments(query),
    ]);

    // Transform response
    const data = budgets.map((b) => ({
      id: String(b._id),
      name: b.name,
      periodType: b.periodType,
      startDate: b.startDate,
      endDate: b.endDate,
      academicPeriod: b.academicPeriodId || null,
      currency: b.currency,
      totalBudgetedMinor: b.totalBudgetedMinor,
      lineItemCount: b.lineItems.length,
      status: b.status,
      notes: b.notes,
      createdBy:
        typeof b.createdBy === "object" && "firstName" in b.createdBy
          ? `${b.createdBy.firstName || ""} ${b.createdBy.lastName || ""}`.trim()
          : null,
      approvedAt: b.approvedAt,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 500 }
    );
  }
}

// ========================
// POST Handler
// ========================

const LineItemSchema = z.object({
  categoryId: z.string().min(1),
  budgetedAmountMinor: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

const CreateBudgetSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  periodType: z.enum(["monthly", "quarterly", "termly", "yearly"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  academicPeriodId: z.string().optional(),
  currency: z.string().optional().default("GHS"),
  lineItems: z.array(LineItemSchema).min(1, "At least one line item is required"),
  notes: z.string().max(1000).optional(),
  status: z.enum(["draft", "active"]).optional().default("draft"),
});

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void Budget.modelName;
    void ExpenseCategory.modelName;

    const body = await req.json();
    const result = CreateBudgetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Get category names
    const categoryIds = data.lineItems.map((li) => new mongoose.Types.ObjectId(li.categoryId));

    interface CategoryLean {
      _id: mongoose.Types.ObjectId;
      name: string;
    }

    const categories = (await ExpenseCategory.find({
      _id: { $in: categoryIds },
      schoolId: schoolIdObj,
    })
      .select("_id name")
      .lean()) as unknown as CategoryLean[];

    const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));

    // Build line items with category names
    const lineItems = data.lineItems.map((li) => ({
      categoryId: new mongoose.Types.ObjectId(li.categoryId),
      categoryName: categoryMap.get(li.categoryId) || "Unknown Category",
      budgetedAmountMinor: li.budgetedAmountMinor,
      notes: li.notes || null,
    }));

    // Create budget
    const budget = await Budget.create({
      schoolId: schoolIdObj,
      name: data.name.trim(),
      periodType: data.periodType as BudgetPeriodType,
      startDate,
      endDate,
      academicPeriodId: data.academicPeriodId
        ? new mongoose.Types.ObjectId(data.academicPeriodId)
        : null,
      currency: data.currency,
      lineItems,
      status: data.status,
      notes: data.notes?.trim() || null,
      createdBy: new mongoose.Types.ObjectId(String(userId)),
    });

    return NextResponse.json({
      success: true,
      budgetId: String(budget._id),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    );
  }
}
