// src/app/api/admin/expenses/vendors/[id]/route.ts
// Individual vendor operations

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Vendor } from "@/models/Vendor";
import { SchoolExpense } from "@/models/SchoolExpense";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/expenses/vendors/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    interface VendorLean {
      _id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      contactPerson?: string | null;
      isActive: boolean;
      createdBy?: { name?: string; email?: string } | null;
    }
    const vendor = await Vendor.findOne({
      _id: id,
      schoolId,
    })
      .populate("createdBy", "name email")
      .lean() as VendorLean | null;

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Get expense stats for this vendor
    const [expenseCount, totalSpent] = await Promise.all([
      SchoolExpense.countDocuments({ schoolId, vendorId: id }),
      SchoolExpense.aggregate([
        {
          $match: {
            schoolId,
            vendorId: vendor._id,
            status: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amountMinor" },
          },
        },
      ]),
    ]);

    return NextResponse.json({
      data: {
        ...vendor,
        stats: {
          expenseCount,
          totalSpentMinor: totalSpent[0]?.total || 0,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching vendor:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/expenses/vendors/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const vendor = await Vendor.findOne({
      _id: id,
      schoolId,
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      phone,
      email,
      address,
      contactPerson,
      taxId,
      bankDetails,
      notes,
      isActive,
    } = body;

    // If renaming, check for duplicates
    if (name && name.trim() !== vendor.name) {
      const existing = await Vendor.findOne({
        schoolId,
        name: name.trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A vendor with this name already exists" },
          { status: 400 }
        );
      }
      vendor.name = name.trim();
    }

    if (phone !== undefined) vendor.phone = phone?.trim() || null;
    if (email !== undefined) vendor.email = email?.trim()?.toLowerCase() || null;
    if (address !== undefined) vendor.address = address?.trim() || null;
    if (contactPerson !== undefined)
      vendor.contactPerson = contactPerson?.trim() || null;
    if (taxId !== undefined) vendor.taxId = taxId?.trim() || null;
    if (notes !== undefined) vendor.notes = notes?.trim() || null;
    if (typeof isActive === "boolean") vendor.isActive = isActive;

    if (bankDetails !== undefined) {
      vendor.bankDetails = bankDetails
        ? {
            bankName: bankDetails.bankName?.trim() || null,
            accountNumber: bankDetails.accountNumber?.trim() || null,
            accountName: bankDetails.accountName?.trim() || null,
          }
        : null;
    }

    await vendor.save();

    return NextResponse.json({ data: vendor });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating vendor:", error);
    return NextResponse.json(
      { error: "Failed to update vendor" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/expenses/vendors/:id
// Soft delete - marks as inactive
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const vendor = await Vendor.findOne({
      _id: id,
      schoolId,
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Check if vendor is in use
    const expenseCount = await SchoolExpense.countDocuments({
      schoolId,
      vendorId: id,
    });

    // Soft delete - mark as inactive
    vendor.isActive = false;
    await vendor.save();

    return NextResponse.json({
      message:
        expenseCount > 0
          ? "Vendor deactivated (has associated expenses)"
          : "Vendor deactivated successfully",
      data: vendor,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      { error: "Failed to delete vendor" },
      { status: 500 }
    );
  }
}
