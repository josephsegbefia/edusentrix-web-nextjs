// src/app/api/admin/promotions/cycles/[cycleId]/placements/auto-assign/route.ts
// PROMO-BE-005: Auto-assign placements for promote decisions
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionCycle } from "@/models/PromotionCycle";
import { selectClassForPromotion } from "@/lib/promotions/placement";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import { logPromotionEvent } from "@/lib/promotions/logging";
import mongoose, { Types } from "mongoose";

/**
 * POST /api/admin/promotions/cycles/:cycleId/placements/auto-assign
 * Assign target grade/class for decisions with promote outcome and no placement yet.
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
    }).select("status");

    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    const allowedStatuses = ["preview_ready", "review_in_progress"];
    if (!allowedStatuses.includes(cycle.status)) {
      return NextResponse.json(
        { success: false, error: "Auto-assign only in preview_ready or review_in_progress" },
        { status: 400 }
      );
    }

    const needsPlacement = await PromotionDecision.find({
      cycleId: cycleObjId,
      schoolId: schoolIdObj,
      finalOutcome: "promote",
      $or: [
        { targetGradeId: null },
        { targetClassGroupId: null },
      ],
    }).lean();

    let assigned = 0;
    let conflicted = 0;

    for (const dec of needsPlacement) {
      const d = dec as { _id: Types.ObjectId; fromGradeId: Types.ObjectId; fromClassGroupId: Types.ObjectId };
      const result = await selectClassForPromotion(d.fromGradeId, d.fromClassGroupId, schoolIdObj);
      if (!result) {
        await PromotionDecision.updateOne(
          { _id: d._id },
          {
            $addToSet: { conflicts: "NO_TARGET_GRADE_MAPPING" },
            $set: { updatedBy: userIdObj },
          }
        );
        conflicted++;
        continue;
      }

      if (result.conflict) {
        await PromotionDecision.updateOne(
          { _id: d._id },
          {
            $addToSet: { conflicts: result.conflict },
            $set: { updatedBy: userIdObj },
          }
        );
        conflicted++;
        continue;
      }

      await PromotionDecision.updateOne(
        { _id: d._id },
        {
          $set: {
            targetGradeId: result.targetGradeId,
            targetClassGroupId: result.targetClassGroupId,
            updatedBy: userIdObj,
          },
          $pull: {
            conflicts: { $in: ["NO_TARGET_GRADE_MAPPING", "NO_CLASSGROUP_TARGET_GRADE", "NO_CAPACITY_TARGET_GRADE"] },
          },
        }
      );
      assigned++;
    }

    if (cycle.status === "preview_ready" && needsPlacement.length > 0) {
      await PromotionCycle.updateOne(
        { _id: cycleObjId },
        { $set: { status: "review_in_progress" } }
      );
    }

    const cycleWithLabel = await PromotionCycle.findById(cycleObjId)
      .select("sourceYearLabel")
      .lean();
    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.decision.placement",
      entityType: "PromotionCycle",
      entityId: cycleObjId,
      description: `Auto-assigned placements in cycle ${cycleWithLabel?.sourceYearLabel ?? ""}: ${assigned} assigned, ${conflicted} conflicted`,
      metadata: {
        cycleId: String(cycleObjId),
        assigned,
        conflicted,
        totalProcessed: needsPlacement.length,
      },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "auto_assign",
      actorId: String(userIdObj),
      assigned,
      conflicted,
    });

    return NextResponse.json({
      success: true,
      data: {
        assigned,
        conflicted,
        totalProcessed: needsPlacement.length,
      },
    });
  } catch (error) {
    console.error("Auto-assign error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to auto-assign placements" },
      { status: 500 }
    );
  }
}
