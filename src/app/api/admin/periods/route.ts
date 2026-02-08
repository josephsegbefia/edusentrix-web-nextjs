// src/app/api/admin/periods/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const periods = await AcademicPeriod.find({ schoolId })
      .sort({ startDate: -1 })
      .lean();

    return NextResponse.json({ periods });
  } catch (error) {
    console.error("Error fetching academic periods:", error);
    return NextResponse.json(
      { error: "Failed to fetch academic periods" },
      { status: 500 }
    );
  }
}
