// src/app/api/admin/promotions/cycles/route.ts
// PROMO-BE-004: GET promotion cycles with pagination
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionCycle } from "@/models/PromotionCycle";
import mongoose from "mongoose";

function parsePositiveInt(val: string | null, defaultVal: number): number {
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : defaultVal;
}

/**
 * GET /api/admin/promotions/cycles
 * Paginated list with filters: page, limit, status, yearLabel, sortBy, sortOrder
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 25);
    const status = searchParams.get("status")?.trim();
    const yearLabel = searchParams.get("yearLabel")?.trim();
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const match: Record<string, unknown> = { schoolId: schoolIdObj };
    if (status) match.status = status;
    if (yearLabel) match.sourceYearLabel = yearLabel;

    const sortStage: Record<string, 1 | -1> =
      sortBy === "status"
        ? { status: sortOrder === "desc" ? -1 : 1, createdAt: -1 }
        : { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [items, total] = await Promise.all([
      PromotionCycle.find(match)
        .sort(sortStage)
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "sourceYearLabel status totals sourceAcademicPeriodId targetAcademicPeriodId createdAt approvedAt finalizedAt"
        )
        .lean(),
      PromotionCycle.countDocuments(match),
    ]);

    const data = items.map((c: Record<string, unknown>) => ({
      id: String(c._id),
      sourceYearLabel: c.sourceYearLabel,
      status: c.status,
      totals: c.totals,
      sourceAcademicPeriodId: c.sourceAcademicPeriodId
        ? String(c.sourceAcademicPeriodId)
        : null,
      targetAcademicPeriodId: c.targetAcademicPeriodId
        ? String(c.targetAcademicPeriodId)
        : null,
      createdAt: (c.createdAt as Date)?.toISOString(),
      approvedAt: (c.approvedAt as Date)?.toISOString?.() ?? null,
      finalizedAt: (c.finalizedAt as Date)?.toISOString?.() ?? null,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Promotion cycles GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cycles" },
      { status: 500 }
    );
  }
}
