// src/app/api/admin/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PeriodReport } from "@/models/PeriodReport";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const academicPeriodId = searchParams.get("academicPeriodId");
    const reportType = searchParams.get("reportType");

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const filter: Record<string, unknown> = { schoolId: schoolIdObj };

    if (academicPeriodId && mongoose.Types.ObjectId.isValid(academicPeriodId)) {
      filter.academicPeriodId = new mongoose.Types.ObjectId(academicPeriodId);
    }

    if (reportType && ["weekly", "biweekly", "monthly", "term"].includes(reportType)) {
      filter.reportType = reportType;
    }

    const reports = await PeriodReport.find(filter)
      .sort({ generatedAt: -1 })
      .limit(50)
      .select("_id academicPeriodId reportType dateRange content.summary generatedAt")
      .lean();

    return NextResponse.json({
      success: true,
      data: reports.map((r) => ({
        id: String(r._id),
        periodId: String(r.academicPeriodId),
        reportType: r.reportType,
        dateRange: r.dateRange
          ? {
              startDate: r.dateRange.startDate,
              endDate: r.dateRange.endDate,
            }
          : null,
        summary: r.content?.summary ?? "",
        generatedAt: r.generatedAt,
      })),
    });
  } catch (error) {
    console.error("Error listing reports:", error);
    return NextResponse.json(
      { error: "Failed to list reports" },
      { status: 500 }
    );
  }
}
