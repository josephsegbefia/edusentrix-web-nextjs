// src/app/api/admin/students/[id]/promotion-history/route.ts
// PROMO-FE-009: Student promotion history
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionCycle } from "@/models/PromotionCycle";
import mongoose from "mongoose";

/**
 * GET /api/admin/students/:id/promotion-history
 * Returns promotion decisions for this student, most recent first.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("promotions");
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const studentObjId = new mongoose.Types.ObjectId(id);
    const schoolObjId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const decisions = await PromotionDecision.find({
      studentId: studentObjId,
      schoolId: schoolObjId,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const cycleIds = [...new Set(decisions.map((d) => String((d as { cycleId: mongoose.Types.ObjectId }).cycleId)))];
    const cycles = await PromotionCycle.find({
      _id: { $in: cycleIds.map((c) => new mongoose.Types.ObjectId(c)) },
    })
      .select("sourceYearLabel status createdAt")
      .lean();

    const cycleMap = new Map(
      cycles.map((c) => [String((c as { _id: mongoose.Types.ObjectId })._id), c])
    );

    const data = decisions.map((d) => {
      const dec = d as {
        _id: mongoose.Types.ObjectId;
        cycleId: mongoose.Types.ObjectId;
        finalOutcome: string;
        recommendedOutcome: string;
        source: string;
        reasonCodes: string[];
        reasonText?: string | null;
        isApplied: boolean;
        appliedAt?: Date | null;
        createdAt: Date;
      };
      const cycle = cycleMap.get(String(dec.cycleId)) as
        | { sourceYearLabel: string; status: string; createdAt: Date }
        | undefined;
      return {
        id: String(dec._id),
        cycleId: String(dec.cycleId),
        cycleYearLabel: cycle?.sourceYearLabel ?? "--",
        cycleStatus: cycle?.status ?? "unknown",
        finalOutcome: dec.finalOutcome,
        recommendedOutcome: dec.recommendedOutcome,
        source: dec.source,
        reasonCodes: dec.reasonCodes ?? [],
        reasonText: dec.reasonText ?? null,
        isApplied: dec.isApplied,
        appliedAt: dec.appliedAt ? new Date(dec.appliedAt).toISOString() : null,
        createdAt: new Date(dec.createdAt).toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Promotion history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch promotion history",
      },
      { status: 500 }
    );
  }
}
