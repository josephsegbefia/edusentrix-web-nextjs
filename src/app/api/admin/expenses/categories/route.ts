// src/app/api/admin/expenses/categories/route.ts
// CRUD operations for expense categories

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExpenseCategory,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/models/ExpenseCategory";

// GET /api/admin/expenses/categories
// List all expense categories for the school
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";
    const parentId = searchParams.get("parentId");

    // Build query
    const query: Record<string, unknown> = { schoolId };
    if (!includeInactive) {
      query.isActive = true;
    }
    if (parentId) {
      query.parentId = parentId === "null" ? null : parentId;
    }

    const categories = await ExpenseCategory.find(query)
      .populate("createdBy", "name email")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ data: categories });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching expense categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense categories" },
      { status: 500 }
    );
  }
}

// POST /api/admin/expenses/categories
// Create a new expense category
export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = await req.json();
    const { name, code, parentId, description } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await ExpenseCategory.findOne({
      schoolId,
      name: name.trim(),
    });
    if (existing) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 400 }
      );
    }

    // Validate parent if provided
    if (parentId) {
      const parent = await ExpenseCategory.findOne({
        _id: parentId,
        schoolId,
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 400 }
        );
      }
    }

    const category = await ExpenseCategory.create({
      schoolId,
      name: name.trim(),
      code: code?.trim() || null,
      parentId: parentId || null,
      description: description?.trim() || null,
      isActive: true,
      createdBy: userId,
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating expense category:", error);
    return NextResponse.json(
      { error: "Failed to create expense category" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/expenses/categories (bulk seed default categories)
export async function PATCH(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = await req.json();
    const { action } = body;

    if (action === "seed_defaults") {
      // Seed default categories if they don't exist
      const existingCategories = await ExpenseCategory.find({ schoolId });
      const existingNames = new Set(
        existingCategories.map((c) => c.name.toLowerCase())
      );

      const categoriesToCreate = DEFAULT_EXPENSE_CATEGORIES.filter(
        (cat) => !existingNames.has(cat.name.toLowerCase())
      );

      if (categoriesToCreate.length === 0) {
        return NextResponse.json({
          message: "All default categories already exist",
          created: 0,
        });
      }

      const created = await ExpenseCategory.insertMany(
        categoriesToCreate.map((cat) => ({
          schoolId,
          name: cat.name,
          code: cat.code,
          description: cat.description,
          isActive: true,
          createdBy: userId,
        }))
      );

      return NextResponse.json({
        message: `Created ${created.length} default categories`,
        created: created.length,
        data: created,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error in expense categories PATCH:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
