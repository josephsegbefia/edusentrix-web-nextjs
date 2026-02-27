// src/app/api/admin/promotions/cycles/[cycleId]/rollback/route.ts
// PROMO-BE-007: POST rollback cycle - restore pre-finalize placements
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionCycle } from "@/models/PromotionCycle";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import { runRollbackBatch } from "@/lib/promotions/rollback-runner";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import { logPromotionEvent } from "@/lib/promotions/logging";
import mongoose from "mongoose";

/**
 * POST /api/admin/promotions/cycles/:cycleId/rollback
 * Restores pre-finalize student placements. Idempotent.
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

    if (cycle.status !== "finalized" && cycle.status !== "rollback_failed") {
      return NextResponse.json(
        {
          success: false,
          error: "Only finalized or rollback_failed (for retry) cycles can be rolled back",
        },
        { status: 400 }
      );
    }

    await PromotionExecutionLog.create({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "rollback_started",
      actorId: userIdObj,
      details: {},
      createdAt: new Date(),
    });
    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.cycle.rollback_started",
      entityType: "PromotionCycle",
      entityId: cycleObjId,
      description: `Rolling back promotion cycle ${cycle.sourceYearLabel}`,
      metadata: { cycleId: String(cycleObjId), sourceYearLabel: cycle.sourceYearLabel },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "rollback_started",
      actorId: String(userIdObj),
    });

    await PromotionCycle.updateOne(
      { _id: cycleObjId },
      {
        $set: {
          status: "rolling_back",
          progress: {
            phase: "rollback",
            processed: 0,
            total: cycle.totals.studentsEvaluated,
            batchSize: 500,
            cursor: "0",
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }
    );

    let cursor: string | undefined;
    let done = false;

    try {
      while (!done) {
        const result = await runRollbackBatch(
          cycleObjId,
          schoolIdObj,
          userIdObj,
          cursor
        );
        done = result.done;
        cursor = result.nextCursor;

        if (result.progress.errors > 0 && result.done) {
          await PromotionCycle.updateOne(
            { _id: cycleObjId },
            {
              $set: {
                status: "rollback_failed",
                progress: {
                  phase: "rollback",
                  processed: result.progress.processed,
                  total: result.progress.total,
                  batchSize: 500,
                  cursor: String(result.progress.processed),
                  updatedAt: new Date(),
                },
              },
            }
          );
          await PromotionExecutionLog.create({
            schoolId: schoolIdObj,
            cycleId: cycleObjId,
            action: "rollback_failed",
            actorId: userIdObj,
            details: {
              error: "Batch had errors",
              ...result.progress,
            },
            createdAt: new Date(),
          });
          return NextResponse.json(
            {
              success: false,
              error: "Rollback completed with errors",
              data: {
                id: String(cycleObjId),
                status: "rollback_failed",
                progress: result.progress,
              },
            },
            { status: 500 }
          );
        }
      }
    } catch (err) {
      console.error("Rollback cycle error:", err);
      await PromotionCycle.updateOne(
        { _id: cycleObjId },
        { $set: { status: "rollback_failed" } }
      );
      await PromotionExecutionLog.create({
        schoolId: schoolIdObj,
        cycleId: cycleObjId,
        action: "rollback_failed",
        actorId: userIdObj,
        details: { error: String(err) },
        createdAt: new Date(),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Rollback failed",
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    const updated = await PromotionCycle.findById(cycleObjId).lean();

    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.cycle.rolled_back",
      entityType: "PromotionCycle",
      entityId: cycleObjId,
      description: `Promotion cycle ${cycle.sourceYearLabel} rolled back`,
      metadata: { cycleId: String(cycleObjId), sourceYearLabel: cycle.sourceYearLabel },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
      action: "rolled_back",
      actorId: String(userIdObj),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(cycleObjId),
        status: updated?.status ?? "rolled_back",
        progress: updated?.progress,
      },
    });
  } catch (error) {
    console.error("Rollback cycle error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Rollback failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
