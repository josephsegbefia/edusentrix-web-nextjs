// src/app/api/admin/fees/structures/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FeeStructure } from "@/models/FeeStructure";
import { toMinorUnits } from "@/lib/fees/money";

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const isActive = searchParams.get("isActive");

    const query: any = { schoolId };

    if (category) {
      query.category = category;
    }
    if (isActive !== null) {
      query.isActive = isActive === "true";
    }

    const structures = await FeeStructure.find(query)
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ structures });
  } catch (error) {
    console.error("Error fetching fee structures:", error);
    return NextResponse.json(
      { error: "Failed to fetch fee structures" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const body = await req.json();
    const {
      name,
      code,
      description,
      category,
      isActive = true,
      defaultAmount,
      allowsInstallments = false,
      maxInstallments,
    } = body;

    // Validate required fields
    if (!name || !code || !category) {
      return NextResponse.json(
        { error: "Name, code, and category are required" },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await FeeStructure.findOne({ schoolId, code });
    if (existing) {
      return NextResponse.json(
        { error: "Fee structure with this code already exists" },
        { status: 400 }
      );
    }

    const structure = await FeeStructure.create({
      schoolId,
      name,
      code: code.toUpperCase(),
      description: description || null,
      category,
      isActive,
      defaultAmountMinor: defaultAmount ? toMinorUnits(defaultAmount) : null,
      allowsInstallments,
      maxInstallments: maxInstallments || null,
    });

    return NextResponse.json({ structure }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating fee structure:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Fee structure with this code already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create fee structure" },
      { status: 500 }
    );
  }
}
