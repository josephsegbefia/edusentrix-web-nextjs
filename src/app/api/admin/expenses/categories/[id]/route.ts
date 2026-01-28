// src/app/api/admin/expenses/categories/[id]/route.ts
// Individual expense category operations

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { SchoolExpense } from "@/models/SchoolExpense";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/expenses/categories/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const category = await ExpenseCategory.findOne({
      _id: id,
      schoolId,
    })
      .populate("createdBy", "name email")
      .lean();

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: category });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching expense category:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense category" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/expenses/categories/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const category = await ExpenseCategory.findOne({
      _id: id,
      schoolId,
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, code, description, isActive, parentId } = body;

    // If renaming, check for duplicates
    if (name && name.trim() !== category.name) {
      const existing = await ExpenseCategory.findOne({
        schoolId,
        name: name.trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 400 }
        );
      }
      category.name = name.trim();
    }

    // Validate parent if provided
    if (parentId !== undefined) {
      if (parentId === id) {
        return NextResponse.json(
          { error: "Category cannot be its own parent" },
          { status: 400 }
        );
      }
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
      category.parentId = parentId || null;
    }

    if (code !== undefined) category.code = code?.trim() || null;
    if (description !== undefined)
      category.description = description?.trim() || null;
    if (typeof isActive === "boolean") category.isActive = isActive;

    await category.save();

    return NextResponse.json({ data: category });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating expense category:", error);
    return NextResponse.json(
      { error: "Failed to update expense category" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/expenses/categories/:id
// Soft delete - marks as inactive
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const category = await ExpenseCategory.findOne({
      _id: id,
      schoolId,
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Check if category is in use
    const expenseCount = await SchoolExpense.countDocuments({
      schoolId,
      categoryId: id,
    });

    if (expenseCount > 0) {
      // Soft delete - mark as inactive
      category.isActive = false;
      await category.save();
      return NextResponse.json({
        message: "Category deactivated (has associated expenses)",
        data: category,
      });
    }

    // Check for child categories
    const childCount = await ExpenseCategory.countDocuments({
      schoolId,
      parentId: id,
    });

    if (childCount > 0) {
      category.isActive = false;
      await category.save();
      return NextResponse.json({
        message: "Category deactivated (has subcategories)",
        data: category,
      });
    }

    // Safe to mark as inactive
    category.isActive = false;
    await category.save();

    return NextResponse.json({
      message: "Category deactivated successfully",
      data: category,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting expense category:", error);
    return NextResponse.json(
      { error: "Failed to delete expense category" },
      { status: 500 }
    );
  }
}
