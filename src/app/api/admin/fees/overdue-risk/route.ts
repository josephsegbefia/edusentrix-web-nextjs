import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { buildOverdueRiskSnapshot } from "@/lib/fees/overdue-risk";

function parseLimit(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 600);
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("fees");
    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"), 80);
    const topLimit = parseLimit(req.nextUrl.searchParams.get("topLimit"), 5);
    const snapshot = await buildOverdueRiskSnapshot({
      schoolId: schoolIdObj,
      limit,
      topLimit,
    });

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch overdue risk snapshot:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch overdue risk snapshot" },
      { status: 500 }
    );
  }
}
