// src/app/api/admin/promotions/cycles/[cycleId]/finalize/route.ts
// PROMO-BE-006: POST finalize cycle (synchronous batch for v1)
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionCycle } from "@/models/PromotionCycle";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import { runFinalizeBatch } from "@/lib/promotions/finalize-runner";
import { promotionFeatureFlags } from "@/lib/promotions/feature-flags";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import { logPromotionEvent } from "@/lib/promotions/logging";
import mongoose from "mongoose";

/**
 * POST /api/admin/promotions/cycles/:cycleId/finalize
 * Runs finalize synchronously in batches (v1). Returns when complete.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { userId, schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "promotions.operate",
    ]);
    await connectToDatabase();

    if (!promotionFeatureFlags.enabled || !promotionFeatureFlags.finalizeEnabled) {
      return NextResponse.json(
        { success: false, error: "Promotion finalization is currently disabled." },
        { status: 403 }
      );
    }

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

    if (cycle.status !== "approved" && cycle.status !== "finalize_failed") {
      return NextResponse.json(
        { success: false, error: "Cycle must be approved or finalize_failed (for retry) before finalize" },
        { status: 400 }
      );
    }

    // For retry: reset from finalize_failed, preserve cursor from progress
    const isRetry = cycle.status === "finalize_failed";
    const resumeCursor = isRetry && cycle.progress?.cursor
      ? cycle.progress.cursor
      : undefined;

    await PromotionExecutionLog.create({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "finalize_started",
      actorId: userIdObj,
      details: {},
      createdAt: new Date(),
    });
    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.cycle.finalize_started",
      entityType: "PromotionCycle",
      entityId: cycleObjId,
      description: `Finalizing promotion cycle ${cycle.sourceYearLabel}`,
      metadata: { cycleId: String(cycleObjId), sourceYearLabel: cycle.sourceYearLabel },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "finalize_started",
      actorId: String(userIdObj),
    });

    await PromotionCycle.updateOne(
      { _id: cycleObjId },
      {
        $set: {
          status: "finalizing",
          progress: {
            phase: "finalize",
            processed: resumeCursor ? parseInt(resumeCursor, 10) : 0,
            total: cycle.totals.studentsEvaluated,
            batchSize: 500,
            cursor: resumeCursor ?? "0",
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }
    );

    let cursor: string | undefined = resumeCursor;
    let done = false;
    let totalApplied = 0;
    let totalErrors = 0;

    while (!done) {
      const result = await runFinalizeBatch(
        cycleObjId,
        schoolIdObj,
        userIdObj,
        cursor
      );
      done = result.done;
      cursor = result.nextCursor;
      totalApplied += result.progress.applied;
      totalErrors += result.progress.errors;
    }

    const updated = await PromotionCycle.findById(cycleObjId).lean();

    if (totalErrors > 0) {
      await PromotionExecutionLog.create({
        schoolId: schoolIdObj,
        cycleId: cycleObjId,
        action: "finalize_failed",
        actorId: userIdObj,
        details: { totalApplied, totalErrors },
        createdAt: new Date(),
      });

      return NextResponse.json(
        {
          success: false,
          error: "Finalize completed with errors",
          message:
            "Some promotion decisions could not be applied. Review decisions with placement conflicts and retry.",
          data: {
            id: String(cycleObjId),
            status: updated?.status ?? "finalize_failed",
            progress: updated?.progress,
            totals: updated?.totals,
          },
        },
        { status: 500 }
      );
    }

    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.cycle.finalized",
      entityType: "PromotionCycle",
      entityId: cycleObjId,
      description: `Promotion cycle ${cycle.sourceYearLabel} finalized`,
      metadata: {
        cycleId: String(cycleObjId),
        sourceYearLabel: cycle.sourceYearLabel,
        totalApplied,
      },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "finalized",
      actorId: String(userIdObj),
      totalApplied,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(cycleObjId),
        status: updated?.status ?? "finalized",
        progress: updated?.progress,
        totals: updated?.totals,
      },
    });
  } catch (error) {
    console.error("Finalize cycle error:", error);
    try {
      const { cycleId } = await ctx.params;
      if (cycleId && mongoose.Types.ObjectId.isValid(cycleId)) {
        await PromotionCycle.updateOne(
          { _id: new mongoose.Types.ObjectId(cycleId) },
          { $set: { status: "finalize_failed", updatedAt: new Date() } }
        );
      }
    } catch {
      // Keep the original finalize failure response.
    }
    return NextResponse.json(
      {
        success: false,
        error: "Finalize failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
