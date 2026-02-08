// src/app/api/admin/fees/structures/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FeeStructure } from "@/models/FeeStructure";
import { toMinorUnits } from "@/lib/fees/money";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { id } = await ctx.params;
    const structure = await FeeStructure.findOne({
      _id: id,
      schoolId,
    }).lean();

    if (!structure) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ structure });
  } catch (error) {
    console.error("Error fetching fee structure:", error);
    return NextResponse.json(
      { error: "Failed to fetch fee structure" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const {
      name,
      code,
      description,
      category,
      isActive,
      defaultAmount,
      allowsInstallments,
      maxInstallments,
    } = body;

    const structure = await FeeStructure.findOne({
      _id: id,
      schoolId,
    });

    if (!structure) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    // Update fields
    if (name !== undefined) structure.name = name;
    if (code !== undefined) structure.code = code.toUpperCase();
    if (description !== undefined) structure.description = description || null;
    if (category !== undefined) structure.category = category;
    if (isActive !== undefined) structure.isActive = isActive;
    if (defaultAmount !== undefined) {
      structure.defaultAmountMinor = defaultAmount ? toMinorUnits(defaultAmount) : null;
    }
    if (allowsInstallments !== undefined)
      structure.allowsInstallments = allowsInstallments;
    if (maxInstallments !== undefined)
      structure.maxInstallments = maxInstallments || null;

    await structure.save();

    return NextResponse.json({ structure });
  } catch (error: any) {
    console.error("Error updating fee structure:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Fee structure with this code already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update fee structure" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { id } = await ctx.params;
    const structure = await FeeStructure.findOne({
      _id: id,
      schoolId,
    });

    if (!structure) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    // Soft delete: set isActive to false
    structure.isActive = false;
    await structure.save();

    return NextResponse.json({ message: "Fee structure deactivated" });
  } catch (error) {
    console.error("Error deleting fee structure:", error);
    return NextResponse.json(
      { error: "Failed to delete fee structure" },
      { status: 500 }
    );
  }
}
