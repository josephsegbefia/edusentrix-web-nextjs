// src/app/api/admin/promotions/cycles/[cycleId]/route.ts
// PROMO-BE-004: GET single promotion cycle, DELETE cycle
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionCycle } from "@/models/PromotionCycle";
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import mongoose from "mongoose";

/**
 * GET /api/admin/promotions/cycles/:cycleId
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { cycleId } = await ctx.params;
    if (!cycleId) {
      return NextResponse.json(
        { success: false, error: "Cycle ID is required" },
        { status: 400 }
      );
    }

    let cycleObjId: mongoose.Types.ObjectId;
    try {
      cycleObjId = new mongoose.Types.ObjectId(cycleId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid cycle ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const cycle = await PromotionCycle.findOne({
      _id: cycleObjId,
      schoolId: schoolIdObj,
    }).lean();

    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    const c = cycle as Record<string, unknown>;
    const data = {
      id: String(c._id),
      sourceYearLabel: c.sourceYearLabel,
      status: c.status,
      totals: c.totals,
      progress: c.progress,
      policySnapshot: c.policySnapshot,
      sourceAcademicPeriodId: c.sourceAcademicPeriodId
        ? String(c.sourceAcademicPeriodId)
        : null,
      targetAcademicPeriodId: c.targetAcademicPeriodId
        ? String(c.targetAcademicPeriodId)
        : null,
      idempotencyKey: c.idempotencyKey,
      lockVersion: c.lockVersion,
      approvedBy: c.approvedBy ? String(c.approvedBy) : null,
      approvedAt: (c.approvedAt as Date)?.toISOString?.() ?? null,
      finalizedBy: c.finalizedBy ? String(c.finalizedBy) : null,
      finalizedAt: (c.finalizedAt as Date)?.toISOString?.() ?? null,
      rollbackOfCycleId: c.rollbackOfCycleId ? String(c.rollbackOfCycleId) : null,
      createdBy: String(c.createdBy),
      createdAt: (c.createdAt as Date)?.toISOString(),
      updatedAt: (c.updatedAt as Date)?.toISOString(),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Promotion cycle GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cycle" },
      { status: 500 }
    );
  }
}

const DELETABLE_STATUSES = [
  "draft",
  "preview_ready",
  "review_in_progress",
  "approved",
  "cancelled",
  "finalize_failed",
  "finalized",
  "rolled_back",
  "rollback_failed",
];

/**
 * DELETE /api/admin/promotions/cycles/:cycleId
 * Deletes a cycle and its decisions/logs. Not allowed for in-progress cycles (finalizing, rolling_back).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { cycleId } = await ctx.params;
    if (!cycleId) {
      return NextResponse.json(
        { success: false, error: "Cycle ID is required" },
        { status: 400 }
      );
    }

    let cycleObjId: mongoose.Types.ObjectId;
    try {
      cycleObjId = new mongoose.Types.ObjectId(cycleId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid cycle ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const cycle = await PromotionCycle.findOne({
      _id: cycleObjId,
      schoolId: schoolIdObj,
    });

    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    if (!DELETABLE_STATUSES.includes(cycle.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete cycle with status "${cycle.status}". Wait for finalize or rollback to complete.`,
        },
        { status: 400 }
      );
    }

    await PromotionDecision.deleteMany({ cycleId: cycleObjId });
    await PromotionExecutionLog.deleteMany({ cycleId: cycleObjId });
    await PromotionCycle.deleteOne({ _id: cycleObjId, schoolId: schoolIdObj });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promotion cycle DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete cycle" },
      { status: 500 }
    );
  }
}
