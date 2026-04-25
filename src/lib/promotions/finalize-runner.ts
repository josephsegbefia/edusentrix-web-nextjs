// src/lib/promotions/finalize-runner.ts
// PROMO-BE-006: Finalize execution - apply decisions to students
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionCycle } from "@/models/PromotionCycle";
import { Student } from "@/models/Student";
import { TermResult } from "@/models/TermResult";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import type { Types } from "mongoose";

const BATCH_SIZE = 500;

export type FinalizeProgress = {
  processed: number;
  total: number;
  applied: number;
  skipped: number;
  errors: number;
};

export async function runFinalizeBatch(
  cycleId: Types.ObjectId,
  schoolId: Types.ObjectId,
  actorId: Types.ObjectId,
  cursor?: string
): Promise<{ progress: FinalizeProgress; done: boolean; nextCursor?: string }> {
  const cycle = await PromotionCycle.findOne({
    _id: cycleId,
    schoolId,
    status: { $in: ["approved", "finalizing", "finalize_failed"] },
  }).select("sourceAcademicPeriodId").lean();

  if (!cycle) {
    throw new Error("Cycle not found or invalid status");
  }

  const sourcePeriodId = cycle.sourceAcademicPeriodId as Types.ObjectId;
  const processedBefore = cursor ? parseInt(cursor, 10) : 0;

  const toProcess = await PromotionDecision.find({
    cycleId,
    schoolId,
    isApplied: false,
  })
    .sort({ _id: 1 })
    .limit(BATCH_SIZE)
    .lean();

  const total = await PromotionDecision.countDocuments({
    cycleId,
    schoolId,
  });

  let applied = 0;
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
        targetGradeId?: Types.ObjectId | null;
        targetClassGroupId?: Types.ObjectId | null;
      };

      const student = await Student.findOne({
        _id: d.studentId,
        schoolId,
      });

      if (!student) {
        await PromotionDecision.updateOne(
          { _id: d._id },
          {
            $set: { isApplied: true, appliedAt: new Date() },
            $addToSet: { reasonCodes: "STUDENT_NOT_FOUND" },
          }
        );
        skipped++;
        continue;
      }

      if (student.status === "withdrawn" || student.status === "inactive") {
        await PromotionDecision.updateOne(
          { _id: d._id },
          {
            $set: { isApplied: true, appliedAt: new Date() },
            $addToSet: { reasonCodes: "STUDENT_NOT_ACTIVE" },
          }
        );
        skipped++;
        continue;
      }

      const isPromoted = d.finalOutcome === "promote" || d.finalOutcome === "graduate";

      if (d.finalOutcome === "promote") {
        if (d.targetGradeId && d.targetClassGroupId) {
          student.gradeId = d.targetGradeId;
          student.classGroupId = d.targetClassGroupId;
        } else {
          await PromotionDecision.updateOne(
            { _id: d._id },
            { $addToSet: { conflicts: "MISSING_TARGET_PLACEMENT" } }
          );
          errors++;
          continue;
        }
      }
      // repeat, hold: no placement change
      // graduate: no placement change in v1

      if (d.finalOutcome === "graduate") {
        student.graduation = {
          graduatedAt: new Date(),
          graduatedFromGradeId: d.fromGradeId,
        };
        student.status = "graduated";
        student.promotionHistoryCount = (student.promotionHistoryCount ?? 0) + 1;
        student.lastPromotionCycleId = cycleId;
        await student.save();
      } else if (d.finalOutcome === "promote") {
        student.promotionHistoryCount = (student.promotionHistoryCount ?? 0) + 1;
        student.lastPromotionCycleId = cycleId;
        await student.save();
      }

      await TermResult.updateOne(
        {
          studentId: d.studentId,
          academicPeriodId: sourcePeriodId,
        },
        { $set: { isPromoted } }
      );

      await PromotionDecision.updateOne(
        { _id: d._id },
        { $set: { isApplied: true, appliedAt: new Date() } }
      );

      await PromotionExecutionLog.create({
        schoolId,
        cycleId,
        action: "student_applied",
        actorId,
        details: { decisionId: String(d._id), outcome: d.finalOutcome },
        createdAt: new Date(),
      });

      applied++;
    } catch (err) {
      console.error("Finalize decision error:", err);
      errors++;
    }
  }

  const remaining = await PromotionDecision.countDocuments({
    cycleId,
    schoolId,
    isApplied: false,
  });
  const newCursor = Math.min(total, processedBefore + toProcess.length);
  const done = remaining === 0 || errors > 0 || toProcess.length === 0;
  const status = errors > 0 ? "finalize_failed" : done ? "finalized" : "finalizing";

  await PromotionCycle.updateOne(
    { _id: cycleId },
    {
      $set: {
        status,
        progress: {
          phase: "finalize",
          processed: newCursor,
          total,
          batchSize: BATCH_SIZE,
          cursor: String(newCursor),
          updatedAt: new Date(),
        },
        ...(status === "finalized"
          ? { finalizedBy: actorId, finalizedAt: new Date() }
          : {}),
      },
    }
  );

  if (status === "finalized") {
    await PromotionExecutionLog.create({
      schoolId,
      cycleId,
      action: "finalize_completed",
      actorId,
      details: { applied, skipped, errors },
      createdAt: new Date(),
    });
  }

  return {
    progress: {
      processed: newCursor,
      total,
      applied,
      skipped,
      errors,
    },
    done,
    nextCursor: done ? undefined : String(newCursor),
  };
}
