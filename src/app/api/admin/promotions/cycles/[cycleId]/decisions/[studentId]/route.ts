// src/app/api/admin/promotions/cycles/[cycleId]/decisions/[studentId]/route.ts
// PROMO-BE-005: PATCH override decision outcome
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionCycle } from "@/models/PromotionCycle";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import { logPromotionEvent } from "@/lib/promotions/logging";
import mongoose from "mongoose";
import { z } from "zod";

const OverrideSchema = z.object({
  finalOutcome: z.enum(["promote", "repeat", "graduate", "hold"]),
  reasonText: z.string().trim().min(1, "Reason is required"),
  version: z.number().int().min(1),
});

/**
 * PATCH /api/admin/promotions/cycles/:cycleId/decisions/:studentId
 * Override outcome. Requires reason and current version for optimistic lock.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ cycleId: string; studentId: string }> }
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

    const { cycleId, studentId } = await ctx.params;
    if (!cycleId || !studentId) {
      return NextResponse.json(
        { success: false, error: "Cycle ID and student ID are required" },
        { status: 400 }
      );
    }

    let cycleObjId: mongoose.Types.ObjectId;
    let studentObjId: mongoose.Types.ObjectId;
    try {
      cycleObjId = new mongoose.Types.ObjectId(cycleId);
      studentObjId = new mongoose.Types.ObjectId(studentId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
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

    const body = await req.json();
    const parsed = OverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

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
        { success: false, error: "Override only allowed in preview_ready or review_in_progress" },
        { status: 400 }
      );
    }

    const decision = await PromotionDecision.findOne({
      cycleId: cycleObjId,
      studentId: studentObjId,
      schoolId: schoolIdObj,
    });

    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decision not found" },
        { status: 404 }
      );
    }

    if (decision.version !== parsed.data.version) {
      return NextResponse.json(
        {
          success: false,
          error: "CONCURRENCY_CONFLICT",
          message: "Data changed. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    decision.finalOutcome = parsed.data.finalOutcome;
    decision.source = "manual_override";
    decision.reasonText = parsed.data.reasonText;
    decision.reasonCodes = [...(decision.reasonCodes || []), "MANUAL_OVERRIDE"];
    decision.version += 1;
    decision.updatedBy = userIdObj;
    await decision.save();

    await PromotionCycle.updateOne(
      { _id: cycleObjId },
      { $inc: { "totals.overrides": 1 } }
    );

    const cycleWithLabel = await PromotionCycle.findById(cycleObjId)
      .select("sourceYearLabel")
      .lean();
    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.decision.override",
      entityType: "PromotionDecision",
      entityId: decision._id,
      description: `Override decision for student in cycle ${cycleWithLabel?.sourceYearLabel ?? ""}`,
      metadata: {
        cycleId: String(cycleObjId),
        studentId: String(studentObjId),
        finalOutcome: parsed.data.finalOutcome,
      },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      studentId: studentObjId,
      action: "decision_override",
      actorId: String(userIdObj),
    });

    const d = decision.toObject();
    return NextResponse.json({
      success: true,
      data: {
        id: String(d._id),
        finalOutcome: d.finalOutcome,
        source: d.source,
        version: d.version,
      },
    });
  } catch (error) {
    console.error("Override decision error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to override decision" },
      { status: 500 }
    );
  }
}
