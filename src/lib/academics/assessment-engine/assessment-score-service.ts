import mongoose from "mongoose";
import { z } from "zod";
import { ASSESSMENT_SCORE_STATUSES } from "@/constants/academics/assessment-engine";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentScore } from "@/models/AssessmentScore";
import { Student } from "@/models/Student";
import { recordAssessmentMarksAudit } from "@/lib/academics/assessment-engine/assessment-marks-audit";
import { resolveTeacherMarksScope } from "@/lib/academics/assessment-engine/assessment-marks-context";
import {
  serializeAssessmentScore,
  type TeacherGradebookAccessContext,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import type { AssessmentScoreDTO } from "@/types/academics/assessment-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const bulkScoreRecordSchema = z.object({
  studentId: objectIdSchema,
  score: z.number().min(0).nullable(),
  status: z.enum(ASSESSMENT_SCORE_STATUSES).optional(),
  remarks: z.string().trim().max(1000).nullable().optional(),
});

export const bulkAssessmentScoresBodySchema = z.object({
  assessmentItemId: objectIdSchema,
  records: z.array(bulkScoreRecordSchema).min(1),
});

export type BulkAssessmentScoresBody = z.infer<typeof bulkAssessmentScoresBodySchema>;
export type TeacherMarksMutationContext = TeacherGradebookAccessContext & {
  userId: mongoose.Types.ObjectId;
};

export function parseBulkAssessmentScoresBody(
  body: unknown
): { ok: true; data: BulkAssessmentScoresBody } | { ok: false; error: string } {
  const parsed = bulkAssessmentScoresBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk score payload",
    };
  }
  return { ok: true, data: parsed.data };
}

export function validateScoreValue(score: number | null, maxScore: number) {
  if (score == null) return { ok: true as const };
  if (score < 0) {
    return { ok: false as const, error: "Score cannot be below 0." };
  }
  if (score > maxScore) {
    return { ok: false as const, error: "Score cannot exceed the assessment item max score." };
  }
  return { ok: true as const };
}

export function resolveScoreStatus(
  score: number | null,
  requestedStatus?: (typeof ASSESSMENT_SCORE_STATUSES)[number]
) {
  if (requestedStatus === "locked") {
    return "locked" as const;
  }
  if (score == null) {
    return requestedStatus ?? ("missing" as const);
  }
  return requestedStatus ?? ("recorded" as const);
}

export function canMutateAssessmentScore(
  existingStatus?: (typeof ASSESSMENT_SCORE_STATUSES)[number] | null
) {
  return existingStatus !== "locked";
}

function computePercentage(score: number | null, maxScore: number) {
  if (score == null || maxScore <= 0) return null;
  return (score / maxScore) * 100;
}

export { computePercentage };

export async function bulkUpsertAssessmentScores(
  context: TeacherMarksMutationContext,
  body: BulkAssessmentScoresBody
): Promise<
  | { ok: true; data: AssessmentScoreDTO[]; updatedCount: number }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const item = await AssessmentItem.findOne({
    _id: new mongoose.Types.ObjectId(body.assessmentItemId),
    schoolId: context.schoolId,
    ...(context.isAdmin ? {} : { teacherId: context.teacherId }),
  }).lean();

  if (!item) {
    return { ok: false, error: "Assessment item not found", status: 404 };
  }

  if (item.status === "archived") {
    return { ok: false, error: "Cannot record scores for an archived assessment item.", status: 400 };
  }

  const scopeResult = await resolveTeacherMarksScope(context, {
    classGroupId: String(item.classGroupId),
    subjectId: String(item.subjectId),
    academicPeriodId: String(item.academicPeriodId),
  });

  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error, status: scopeResult.status };
  }

  const scope = scopeResult.scope;

  if (String(item.assessmentPlanId) !== scope.assessmentPlan._id) {
    return {
      ok: false,
      error: "Assessment item does not belong to the active assessment plan.",
      status: 400,
    };
  }

  const studentIds = body.records.map(
    (record) => new mongoose.Types.ObjectId(record.studentId)
  );

  const students = await Student.find({
    _id: { $in: studentIds },
    schoolId: context.schoolId,
    classGroupId: item.classGroupId,
    status: "active",
  })
    .select("_id")
    .lean();

  if (students.length !== studentIds.length) {
    return {
      ok: false,
      error: "One or more students are invalid for this class group.",
      status: 400,
    };
  }

  const existingScores = await AssessmentScore.find({
    schoolId: context.schoolId,
    assessmentItemId: item._id,
    studentId: { $in: studentIds },
  })
    .select("_id studentId status")
    .lean();

  const existingByStudentId = new Map(
    existingScores.map((score) => [String(score.studentId), score])
  );

  for (const record of body.records) {
    const validation = validateScoreValue(record.score, item.maxScore);
    if (!validation.ok) {
      return { ok: false, error: validation.error, status: 400 };
    }

    const existing = existingByStudentId.get(record.studentId);
    if (existing && !canMutateAssessmentScore(existing.status)) {
      return {
        ok: false,
        error: "One or more scores are locked and cannot be changed.",
        status: 400,
      };
    }
  }

  const now = new Date();
  const operations = body.records.map((record) => {
    const status = resolveScoreStatus(record.score, record.status);
    const percentage = computePercentage(record.score, item.maxScore);

    return {
      updateOne: {
        filter: {
          schoolId: context.schoolId,
          assessmentItemId: item._id,
          studentId: new mongoose.Types.ObjectId(record.studentId),
        },
        update: {
          $set: {
            academicPeriodId: item.academicPeriodId,
            assessmentPlanId: item.assessmentPlanId,
            classGroupId: item.classGroupId,
            subjectId: item.subjectId,
            teacherId: context.teacherId,
            score: record.score,
            maxScoreSnapshot: item.maxScore,
            percentage,
            status,
            remarks: record.remarks ?? null,
            gradedAt: record.score == null ? null : now,
            recordedBy: context.userId,
            updatedBy: context.userId,
          },
          $setOnInsert: {
            schoolId: context.schoolId,
            academicPeriodId: item.academicPeriodId,
            assessmentPlanId: item.assessmentPlanId,
            classGroupId: item.classGroupId,
            subjectId: item.subjectId,
            teacherId: context.teacherId,
            assessmentItemId: item._id,
            studentId: new mongoose.Types.ObjectId(record.studentId),
          },
        },
        upsert: true,
      },
    };
  });

  await AssessmentScore.bulkWrite(operations, { ordered: false });

  const savedScores = await AssessmentScore.find({
    schoolId: context.schoolId,
    assessmentItemId: item._id,
    studentId: { $in: studentIds },
  }).lean();

  await recordAssessmentMarksAudit({
    schoolId: context.schoolId,
    actorUserId: context.userId,
    teacherId: context.teacherId,
    action: "assessment_scores.bulk_updated",
    entityType: "assessment_score_batch",
    entityId: item._id as mongoose.Types.ObjectId,
    classGroupId: scope.classGroupId,
    subjectId: scope.subjectId,
    academicPeriodId: scope.academicPeriodId,
    assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
    metadata: {
      assessmentItemId: String(item._id),
      recordCount: body.records.length,
      studentIds: body.records.map((record) => record.studentId),
      changedScores: body.records.map((record) => ({
        studentId: record.studentId,
        score: record.score,
        status: resolveScoreStatus(record.score, record.status),
      })),
    },
  });

  return {
    ok: true,
    data: savedScores.map((score) => serializeAssessmentScore(score)),
    updatedCount: body.records.length,
  };
}
