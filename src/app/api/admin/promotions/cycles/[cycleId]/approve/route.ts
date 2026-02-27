// src/app/api/admin/promotions/cycles/[cycleId]/approve/route.ts
// PROMO-BE-006: POST approve cycle
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionCycle } from "@/models/PromotionCycle";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import { logPromotionEvent } from "@/lib/promotions/logging";
import mongoose from "mongoose";

/**
 * POST /api/admin/promotions/cycles/:cycleId/approve
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: "Idempotency-Key header is required" },
        { status: 400 }
      );
    }

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
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

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

    if (cycle.status !== "preview_ready" && cycle.status !== "review_in_progress") {
      return NextResponse.json(
        { success: false, error: "Cycle must be in preview_ready or review_in_progress to approve" },
        { status: 400 }
      );
    }

    cycle.status = "approved";
    cycle.approvedBy = userIdObj;
    cycle.approvedAt = new Date();
    await cycle.save();

    await PromotionExecutionLog.create({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "approved",
      actorId: userIdObj,
      details: {},
      createdAt: new Date(),
    });

    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.cycle.approved",
      entityType: "PromotionCycle",
      entityId: cycleObjId,
      description: `Promotion cycle ${cycle.sourceYearLabel} approved`,
      metadata: { cycleId: String(cycleObjId), sourceYearLabel: cycle.sourceYearLabel },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "approved",
      actorId: String(userIdObj),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(cycle._id),
        status: cycle.status,
        approvedAt: cycle.approvedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Approve cycle error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve cycle" },
      { status: 500 }
    );
  }
}
