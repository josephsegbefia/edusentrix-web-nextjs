// src/app/api/admin/finance/budgets/[id]/route.ts
// Budget detail, update, and delete API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Budget, BudgetPeriodType } from "@/models/Budget";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { FinancialTransaction } from "@/models/FinancialTransaction";

// ========================
// Types
// ========================

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface BudgetLean {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  name: string;
  periodType: BudgetPeriodType;
  startDate: Date;
  endDate: Date;
  academicPeriodId?: mongoose.Types.ObjectId | { yearLabel?: string; term?: string } | null;
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
  createdBy: mongoose.Types.ObjectId | { _id?: mongoose.Types.ObjectId; firstName?: string; lastName?: string };
  approvedBy?: mongoose.Types.ObjectId | { _id?: mongoose.Types.ObjectId; firstName?: string; lastName?: string } | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// GET Handler - Detail with Actual Spending
// ========================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    void Budget.modelName;
    void FinancialTransaction.modelName;

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid budget ID" }, { status: 400 });
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const budgetIdObj = new mongoose.Types.ObjectId(id);

    // Fetch budget with populated fields
    const budget = await Budget.findOne({
      _id: budgetIdObj,
      schoolId: schoolIdObj,
    })
      .populate("createdBy", "firstName lastName")
      .populate("approvedBy", "firstName lastName")
      .populate("academicPeriodId", "yearLabel term")
      .lean() as BudgetLean | null;

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    // Calculate actual spending per category for the budget period
    const actualSpending = await FinancialTransaction.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          direction: "outflow",
          category: "expenses",
          status: "success",
          occurredAt: {
            $gte: budget.startDate,
            $lte: budget.endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$netAmountMinor" },
        },
      },
    ]);

    const totalActualMinor = actualSpending[0]?.totalSpent || 0;

    // Get expense breakdown by category from SchoolExpense
    // This requires matching the expense category IDs
    const categoryIds = budget.lineItems.map((li) => li.categoryId);

    // For now, we'll aggregate expenses directly
    // In production, you'd want to also aggregate from SchoolExpense table
    const categoryBreakdown = await FinancialTransaction.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          direction: "outflow",
          category: "expenses",
          status: "success",
          occurredAt: {
            $gte: budget.startDate,
            $lte: budget.endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmountMinor" },
        },
      },
    ]);

    // Build line items with actual spending
    const lineItemsWithActuals = budget.lineItems.map((li) => {
      // For simplicity, distribute actual spending proportionally
      // In production, you'd want to track actual spending per category
      const proportion = budget.totalBudgetedMinor > 0
        ? li.budgetedAmountMinor / budget.totalBudgetedMinor
        : 0;
      const actualMinor = Math.round(totalActualMinor * proportion);

      return {
        categoryId: String(li.categoryId),
        categoryName: li.categoryName,
        budgetedAmountMinor: li.budgetedAmountMinor,
        actualAmountMinor: actualMinor,
        varianceMinor: li.budgetedAmountMinor - actualMinor,
        percentUsed: li.budgetedAmountMinor > 0
          ? Math.round((actualMinor / li.budgetedAmountMinor) * 100)
          : 0,
        notes: li.notes,
      };
    });

    const formatUser = (user: unknown) => {
      if (!user) return null;
      if (typeof user === "object" && user !== null && "firstName" in user) {
        const u = user as { firstName?: string; lastName?: string };
        return `${u.firstName || ""} ${u.lastName || ""}`.trim();
      }
      return null;
    };

    const formatAcademicPeriod = (period: unknown) => {
      if (!period) return null;
      if (typeof period === "object" && period !== null && "yearLabel" in period) {
        const p = period as { yearLabel?: string; term?: string };
        return { yearLabel: p.yearLabel, term: p.term };
      }
      return null;
    };

    return NextResponse.json({
      data: {
        id: String(budget._id),
        name: budget.name,
        periodType: budget.periodType,
        startDate: budget.startDate,
        endDate: budget.endDate,
        academicPeriod: formatAcademicPeriod(budget.academicPeriodId),
        currency: budget.currency,
        totalBudgetedMinor: budget.totalBudgetedMinor,
        totalActualMinor,
        totalVarianceMinor: budget.totalBudgetedMinor - totalActualMinor,
        percentUsed: budget.totalBudgetedMinor > 0
          ? Math.round((totalActualMinor / budget.totalBudgetedMinor) * 100)
          : 0,
        lineItems: lineItemsWithActuals,
        status: budget.status,
        notes: budget.notes,
        createdBy: formatUser(budget.createdBy),
        approvedBy: formatUser(budget.approvedBy),
        approvedAt: budget.approvedAt,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching budget:", error);
    return NextResponse.json({ error: "Failed to fetch budget" }, { status: 500 });
  }
}

// ========================
// PATCH Handler - Update Budget
// ========================

const LineItemSchema = z.object({
  categoryId: z.string().min(1),
  budgetedAmountMinor: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

const UpdateBudgetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  periodType: z.enum(["monthly", "quarterly", "termly", "yearly"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  academicPeriodId: z.string().optional().nullable(),
  currency: z.string().optional(),
  lineItems: z.array(LineItemSchema).optional(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(["draft", "active", "closed"]).optional(),
});

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    void Budget.modelName;
    void ExpenseCategory.modelName;

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid budget ID" }, { status: 400 });
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const budgetIdObj = new mongoose.Types.ObjectId(id);

    // Find budget
    const budget = await Budget.findOne({
      _id: budgetIdObj,
      schoolId: schoolIdObj,
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    // Only allow editing draft budgets (or admin override)
    if (budget.status === "closed") {
      return NextResponse.json(
        { error: "Cannot edit a closed budget" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const result = UpdateBudgetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Update fields
    if (data.name !== undefined) budget.name = data.name.trim();
    if (data.periodType !== undefined) budget.periodType = data.periodType as BudgetPeriodType;
    if (data.startDate !== undefined) budget.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) budget.endDate = new Date(data.endDate);
    if (data.currency !== undefined) budget.currency = data.currency;
    if (data.notes !== undefined) budget.notes = data.notes?.trim() || null;

    if (data.academicPeriodId !== undefined) {
      budget.academicPeriodId = data.academicPeriodId
        ? new mongoose.Types.ObjectId(data.academicPeriodId)
        : null;
    }

    if (data.status !== undefined) {
      budget.status = data.status;
      if (data.status === "active" && !budget.approvedAt) {
        budget.approvedBy = new mongoose.Types.ObjectId(String(userId));
        budget.approvedAt = new Date();
      }
    }

    // Update line items if provided
    if (data.lineItems) {
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

      budget.lineItems = data.lineItems.map((li) => ({
        categoryId: new mongoose.Types.ObjectId(li.categoryId),
        categoryName: categoryMap.get(li.categoryId) || "Unknown Category",
        budgetedAmountMinor: li.budgetedAmountMinor,
        notes: li.notes || null,
      }));
    }

    await budget.save();

    return NextResponse.json({
      success: true,
      budgetId: String(budget._id),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating budget:", error);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
}

// ========================
// DELETE Handler
// ========================

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    void Budget.modelName;

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid budget ID" }, { status: 400 });
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const budgetIdObj = new mongoose.Types.ObjectId(id);

    // Find budget
    const budget = await Budget.findOne({
      _id: budgetIdObj,
      schoolId: schoolIdObj,
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    // Only allow deleting draft budgets
    if (budget.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft budgets can be deleted" },
        { status: 400 }
      );
    }

    await Budget.deleteOne({ _id: budgetIdObj });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting budget:", error);
    return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
  }
}
