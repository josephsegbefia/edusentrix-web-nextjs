// src/app/api/admin/expenses/vendors/route.ts
// CRUD operations for vendors

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Vendor } from "@/models/Vendor";

// GET /api/admin/expenses/vendors
// List all vendors for the school
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";
    const search = searchParams.get("q");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    // Build query
    const query: Record<string, unknown> = { schoolId };
    if (!includeInactive) {
      query.isActive = true;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .populate("createdBy", "name email")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(query),
    ]);

    return NextResponse.json({
      data: vendors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    );
  }
}

// POST /api/admin/expenses/vendors
// Create a new vendor
export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

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
    } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Vendor name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await Vendor.findOne({
      schoolId,
      name: name.trim(),
    });
    if (existing) {
      return NextResponse.json(
        { error: "A vendor with this name already exists" },
        { status: 400 }
      );
    }

    const vendor = await Vendor.create({
      schoolId,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim()?.toLowerCase() || null,
      address: address?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      taxId: taxId?.trim() || null,
      bankDetails: bankDetails
        ? {
            bankName: bankDetails.bankName?.trim() || null,
            accountNumber: bankDetails.accountNumber?.trim() || null,
            accountName: bankDetails.accountName?.trim() || null,
          }
        : null,
      notes: notes?.trim() || null,
      isActive: true,
      createdBy: userId,
    });

    return NextResponse.json({ data: vendor }, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    );
  }
}
