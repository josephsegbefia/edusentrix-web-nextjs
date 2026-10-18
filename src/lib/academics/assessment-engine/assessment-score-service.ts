import mongoose, { type ClientSession } from "mongoose";
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

export function hasDuplicateStudentIds(records: Pick<BulkAssessmentScoresBody["records"][number], "studentId">[]) {
  return new Set(records.map((record) => record.studentId)).size !== records.length;
}

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

export function buildConditionalAssessmentScoreFilter(input: {
  schoolId: mongoose.Types.ObjectId;
  assessmentItemId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  existingId?: mongoose.Types.ObjectId;
}) {
  return {
    ...(input.existingId ? { _id: input.existingId } : {}),
    schoolId: input.schoolId,
    assessmentItemId: input.assessmentItemId,
    studentId: input.studentId,
    status: { $ne: "locked" as const },
  };
}

function computePercentage(score: number | null, maxScore: number) {
  if (score == null || maxScore <= 0) return null;
  return (score / maxScore) * 100;
}

export { computePercentage };

export class AssessmentScoreWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessmentScoreWriteConflictError";
  }
}

/**
 * Canonical Core score write used by an authorized Premium handoff.
 *
 * The caller owns the MongoDB transaction. This boundary deliberately refuses
 * to mutate an existing score: ordinary teacher/admin gradebook writers retain
 * their existing conditional-update behavior, while an approved Premium
 * result must never overwrite an official Core value.
 */
export async function writeAssessmentScoreFromAuthorizedHandoff(input: {
  session: ClientSession;
  schoolId: mongoose.Types.ObjectId;
  assessmentItemId: mongoose.Types.ObjectId;
  assessmentPlanId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  score: number;
  maxScore: number;
}) {
  if (!Number.isFinite(input.score) || !Number.isFinite(input.maxScore)) {
    throw new AssessmentScoreWriteConflictError("Core score values must be finite numbers.");
  }
  if (Math.abs(input.score * 100 - Math.round(input.score * 100)) > 1e-9) {
    throw new AssessmentScoreWriteConflictError("Core score precision is limited to two decimal places.");
  }
  const validation = validateScoreValue(input.score, input.maxScore);
  if (!validation.ok) throw new AssessmentScoreWriteConflictError(validation.error);

  const identityFilter = {
    schoolId: input.schoolId,
    assessmentItemId: input.assessmentItemId,
    studentId: input.studentId,
  };
  const existing = await AssessmentScore.findOne(identityFilter)
    .session(input.session)
    .select("_id status score maxScoreSnapshot")
    .lean();
  if (existing) {
    throw new AssessmentScoreWriteConflictError(
      "A Core score already exists for this student and assessment item; no score was overwritten."
    );
  }

  const now = new Date();
  try {
    const [created] = await AssessmentScore.create(
      [{
        ...identityFilter,
        academicPeriodId: input.academicPeriodId,
        assessmentPlanId: input.assessmentPlanId,
        classGroupId: input.classGroupId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        score: input.score,
        maxScoreSnapshot: input.maxScore,
        percentage: computePercentage(input.score, input.maxScore),
        status: "recorded",
        remarks: null,
        gradedAt: now,
        recordedBy: input.actorUserId,
        updatedBy: input.actorUserId,
        sourceSubmissionId: null,
      }],
      { session: input.session }
    );
    return created;
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      throw new AssessmentScoreWriteConflictError(
        "A concurrent Core score already exists for this student and assessment item; no score was overwritten."
      );
    }
    throw error;
  }
}

export async function bulkUpsertAssessmentScores(
  context: TeacherMarksMutationContext,
  body: BulkAssessmentScoresBody
): Promise<
  | { ok: true; data: AssessmentScoreDTO[]; updatedCount: number }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 }
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

  if (hasDuplicateStudentIds(body.records)) {
    return {
      ok: false,
      error: "Each student may appear only once in a bulk score request.",
      status: 400,
    };
  }

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
  const scoreUpdates = body.records.map((record) => {
    const status = resolveScoreStatus(record.score, record.status);
    const percentage = computePercentage(record.score, item.maxScore);

    return {
      record,
      studentId: new mongoose.Types.ObjectId(record.studentId),
      existing: existingByStudentId.get(record.studentId),
      update: {
        $set: {
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
    };
  });

  let writtenCount = 0;
  const failures: string[] = [];
  for (const scoreUpdate of scoreUpdates) {
    const keyFilter = {
      schoolId: context.schoolId,
      assessmentItemId: item._id,
      studentId: scoreUpdate.studentId,
    };
    const conditionalFilter = buildConditionalAssessmentScoreFilter({
      ...keyFilter,
      existingId: scoreUpdate.existing?._id,
    });

    try {
      const result = await AssessmentScore.updateOne(
        conditionalFilter,
        scoreUpdate.update,
        { upsert: !scoreUpdate.existing }
      );
      if (result.matchedCount > 0 || result.upsertedCount > 0) {
        writtenCount += 1;
        continue;
      }

      const current = await AssessmentScore.findOne(keyFilter).select("status").lean();
      failures.push(
        current?.status === "locked"
          ? `${scoreUpdate.record.studentId}: score is locked`
          : `${scoreUpdate.record.studentId}: conditional score update did not match`
      );
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000 && !scoreUpdate.existing) {
        const retry = await AssessmentScore.updateOne(
          buildConditionalAssessmentScoreFilter(keyFilter),
          { $set: scoreUpdate.update.$set },
          { upsert: false }
        );
        if (retry.matchedCount > 0) {
          writtenCount += 1;
          continue;
        }
      }
      failures.push(`${scoreUpdate.record.studentId}: score write failed`);
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      error: `${failures.length} score update(s) were not applied; ${writtenCount} prior update(s) may have been saved. ${failures.join("; ")}`,
      status: 409,
    };
  }

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
