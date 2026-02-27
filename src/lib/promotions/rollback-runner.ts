// src/lib/promotions/rollback-runner.ts
// PROMO-BE-007: Rollback execution - restore pre-finalize placements
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionCycle } from "@/models/PromotionCycle";
import { Student } from "@/models/Student";
import { TermResult } from "@/models/TermResult";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import type { Types } from "mongoose";

const BATCH_SIZE = 500;

export type RollbackProgress = {
  processed: number;
  total: number;
  restored: number;
  skipped: number;
  errors: number;
};

export async function runRollbackBatch(
  cycleId: Types.ObjectId,
  schoolId: Types.ObjectId,
  actorId: Types.ObjectId,
  cursor?: string
): Promise<{ progress: RollbackProgress; done: boolean; nextCursor?: string }> {
  const cycle = await PromotionCycle.findOne({
    _id: cycleId,
    schoolId,
    status: { $in: ["finalized", "rolling_back", "rollback_failed"] },
  })
    .select("sourceAcademicPeriodId")
    .lean();

  if (!cycle) {
    throw new Error("Cycle not found or invalid status for rollback");
  }

  const sourcePeriodId = cycle.sourceAcademicPeriodId as Types.ObjectId;
  const skip = cursor ? parseInt(cursor, 10) : 0;

  const toProcess = await PromotionDecision.find({
    cycleId,
    schoolId,
    isApplied: true,
  })
    .sort({ _id: 1 })
    .skip(skip)
    .limit(BATCH_SIZE)
    .lean();

  const total = await PromotionDecision.countDocuments({
    cycleId,
    schoolId,
    isApplied: true,
  });

  let restored = 0;
  let skipped = 0;
  let errors = 0;

  for (const dec of toProcess) {
    try {
      const d = dec as {
        _id: Types.ObjectId;
        studentId: Types.ObjectId;
        finalOutcome: string;
        fromGradeId: Types.ObjectId;
        fromClassGroupId: Types.ObjectId;
      };

      const student = await Student.findOne({
        _id: d.studentId,
        schoolId,
      });

      if (!student) {
        skipped++;
        await PromotionDecision.updateOne(
          { _id: d._id },
          { $set: { isApplied: false } }
        );
        continue;
      }

      // Restore pre-finalize grade/class
      student.gradeId = d.fromGradeId;
      student.classGroupId = d.fromClassGroupId;

      // Revert promotion metadata for promote/graduate
      if (d.finalOutcome === "promote" || d.finalOutcome === "graduate") {
        student.promotionHistoryCount = Math.max(
          0,
          (student.promotionHistoryCount ?? 1) - 1
        );
        if (
          student.lastPromotionCycleId &&
          student.lastPromotionCycleId.toString() === cycleId.toString()
        ) {
          student.lastPromotionCycleId = undefined;
        }
      }

      if (d.finalOutcome === "graduate") {
        student.graduation = undefined;
        student.status = "active";
      }

      await student.save();

      // Revert TermResult.isPromoted
      const wasPromoted =
        d.finalOutcome === "promote" || d.finalOutcome === "graduate";
      if (wasPromoted) {
        await TermResult.updateOne(
          {
            studentId: d.studentId,
            academicPeriodId: sourcePeriodId,
          },
          { $set: { isPromoted: false } }
        );
      }

      await PromotionDecision.updateOne(
        { _id: d._id },
        { $set: { isApplied: false } }
      );

      restored++;
    } catch (err) {
      console.error("Rollback decision error:", err);
      errors++;
    }
  }

  const newCursor = skip + toProcess.length;
  const done = toProcess.length < BATCH_SIZE;

  await PromotionCycle.updateOne(
    { _id: cycleId },
    done
      ? {
          $set: { status: "rolled_back" },
          $unset: { progress: 1 },
        }
      : {
          $set: {
            status: "rolling_back",
            progress: {
              phase: "rollback",
              processed: newCursor,
              total,
              batchSize: BATCH_SIZE,
              cursor: String(newCursor),
              updatedAt: new Date(),
            },
          },
        }
  );

  if (done) {
    await PromotionExecutionLog.create({
      schoolId,
      cycleId,
      action: "rollback_completed",
      actorId,
      details: { restored, skipped, errors },
      createdAt: new Date(),
    });
  }

  return {
    progress: {
      processed: newCursor,
      total,
      restored,
      skipped,
      errors,
    },
    done,
    nextCursor: done ? undefined : String(newCursor),
  };
}
