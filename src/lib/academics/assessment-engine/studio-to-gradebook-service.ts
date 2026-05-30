import mongoose from "mongoose";
import { z } from "zod";
import type {
  AssessmentEngineAssessmentType,
  AssessmentItemDTO,
  AssessmentSourceType,
} from "@/types/academics/assessment-engine";
import { Homework, type HomeworkType, type IHomework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { Student } from "@/models/Student";
import { AssessmentItem, type IAssessmentItem } from "@/models/AssessmentItem";
import { AssessmentScore } from "@/models/AssessmentScore";
import { ClassGroup } from "@/models/ClassGroup";
import { recordAssessmentMarksAudit } from "@/lib/academics/assessment-engine/assessment-marks-audit";
import { resolveTeacherMarksScope } from "@/lib/academics/assessment-engine/assessment-marks-context";
import {
  canMutateAssessmentItem,
  resolveContributionFlags,
} from "@/lib/academics/assessment-engine/assessment-item-service";
import {
  canMutateAssessmentScore,
  computePercentage,
  resolveScoreStatus,
  validateScoreValue,
  type TeacherMarksMutationContext,
} from "@/lib/academics/assessment-engine/assessment-score-service";
import {
  serializeAssessmentItem,
  serializeAssessmentScore,
  type TeacherGradebookAccessContext,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";

export const STUDIO_HOMEWORK_SOURCE_REF_TYPE = "homework";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

export const addStudioToGradebookBodySchema = z.object({
  classGroupId: objectIdSchema,
  contributionMode: z.enum(["non_report", "report"]),
  componentKey: z.string().trim().max(80).nullable().optional(),
});

export type AddStudioToGradebookBody = z.infer<typeof addStudioToGradebookBodySchema>;

export type StudioGradebookLinkDTO = {
  homeworkId: string;
  homeworkTitle: string;
  homeworkType: HomeworkType;
  subjectId: string;
  subjectName: string | null;
  academicPeriodId: string;
  eligible: boolean;
  eligibilityNotes: string[];
  gradedSubmissionCount: number;
  canRecordMarks: boolean;
  canMarkReportContributing: boolean;
  classGroups: Array<{
    id: string;
    name: string;
    linkedAssessmentItemId: string | null;
    contributesToReport: boolean;
    componentKey: string | null;
    gradedSubmissionCount: number;
  }>;
  scoreComponents: Array<{ key: string; label: string }>;
  marksWorkspacePath: string | null;
};

export type StudioGradebookImportResult = {
  assessmentItem: AssessmentItemDTO;
  importedScoreCount: number;
  skippedLockedScores: number;
  marksWorkspacePath: string;
};

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

export function mapHomeworkTypeToAssessmentType(type: HomeworkType): AssessmentEngineAssessmentType {
  switch (type) {
    case "quiz":
      return "quiz";
    case "project":
      return "project";
    case "practice":
      return "formative";
    default:
      return "assignment";
  }
}

export function mapHomeworkTypeToSourceType(type: HomeworkType): AssessmentSourceType {
  return type === "quiz" ? "app_quiz" : "app_assignment";
}

export function parseAddStudioToGradebookBody(
  body: unknown
): { ok: true; data: AddStudioToGradebookBody } | { ok: false; error: string } {
  const parsed = addStudioToGradebookBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid gradebook link payload",
    };
  }

  if (parsed.data.contributionMode === "report" && !parsed.data.componentKey) {
    return {
      ok: false,
      error: "Choose a grading policy component for report-contributing marks.",
    };
  }

  return { ok: true, data: parsed.data };
}

async function loadOwnedHomework(
  context: TeacherGradebookAccessContext,
  homeworkId: string
): Promise<
  | { ok: true; homework: IHomework }
  | { ok: false; error: string; status: 403 | 404 }
> {
  if (!mongoose.Types.ObjectId.isValid(homeworkId)) {
    return { ok: false, error: "Invalid assignment id", status: 404 };
  }

  const homework = (await Homework.findOne({
    _id: toObjectId(homeworkId),
    schoolId: context.schoolId,
    ...(context.isAdmin ? {} : { teacherId: context.teacherId }),
  }).lean()) as IHomework | null;

  if (!homework) {
    return { ok: false, error: "Assignment not found", status: 404 };
  }

  return { ok: true, homework };
}

async function countGradedSubmissionsForClass(input: {
  homeworkId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  targetStudentIds?: mongoose.Types.ObjectId[];
}) {
  const studentQuery: Record<string, unknown> = {
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: "active",
  };

  if (input.targetStudentIds?.length) {
    studentQuery._id = { $in: input.targetStudentIds };
  }

  const students = await Student.find(studentQuery).select("_id").lean();
  const studentIds = students.map((student) => student._id);

  if (studentIds.length === 0) {
    return 0;
  }

  return Submission.countDocuments({
    homeworkId: input.homeworkId,
    schoolId: input.schoolId,
    studentId: { $in: studentIds },
    status: "graded",
    score: { $ne: null },
  });
}

export async function getStudioGradebookLinkPreview(
  context: TeacherGradebookAccessContext,
  homeworkId: string
): Promise<
  | { ok: true; data: StudioGradebookLinkDTO }
  | { ok: false; error: string; status: 403 | 404 | 400 }
> {
  const homeworkResult = await loadOwnedHomework(context, homeworkId);
  if (!homeworkResult.ok) {
    return homeworkResult;
  }

  const homework = homeworkResult.homework;
  const classGroupIds = homework.classGroupIds ?? [];
  const classGroups = await ClassGroup.find({
    _id: { $in: classGroupIds },
    schoolId: context.schoolId,
  })
    .select("_id name")
    .lean();

  const linkedItems = (await AssessmentItem.find({
    schoolId: context.schoolId,
    sourceRefType: STUDIO_HOMEWORK_SOURCE_REF_TYPE,
    sourceRefId: homework._id,
    classGroupId: { $in: classGroupIds },
  })
    .select("_id classGroupId contributesToReport componentKey")
    .lean()) as Array<
    Pick<IAssessmentItem, "_id" | "classGroupId" | "contributesToReport" | "componentKey">
  >;

  const linkedByClassGroupId = new Map(
    linkedItems.map((item) => [String(item.classGroupId), item])
  );

  const classGroupRows = await Promise.all(
    classGroups.map(async (group) => {
      const linked = linkedByClassGroupId.get(String(group._id));
      const gradedSubmissionCount = await countGradedSubmissionsForClass({
        homeworkId: homework._id,
        schoolId: context.schoolId,
        classGroupId: group._id as mongoose.Types.ObjectId,
        targetStudentIds: homework.targetStudentIds,
      });

      return {
        id: String(group._id),
        name: group.name,
        linkedAssessmentItemId: linked ? String(linked._id) : null,
        contributesToReport: linked?.contributesToReport ?? false,
        componentKey: linked?.componentKey ?? null,
        gradedSubmissionCount,
      };
    })
  );

  const eligibilityNotes: string[] = [];
  const totalGraded = classGroupRows.reduce(
    (sum, group) => sum + group.gradedSubmissionCount,
    0
  );

  if (homework.status === "draft") {
    eligibilityNotes.push("Publish the assignment before importing marks to the gradebook.");
  }
  if (totalGraded === 0) {
    eligibilityNotes.push("Grade at least one submission before adding marks to the gradebook.");
  }

  let canMarkReportContributing = false;
  let scoreComponents: Array<{ key: string; label: string }> = [];
  let hasActiveAssessmentPlan = false;
  const firstClassGroupId = classGroupRows[0]?.id;

  if (firstClassGroupId) {
    const scopeResult = await resolveTeacherMarksScope(context, {
      classGroupId: firstClassGroupId,
      subjectId: String(homework.subjectId),
      academicPeriodId: String(homework.academicPeriodId),
    });

    if (scopeResult.ok) {
      hasActiveAssessmentPlan = scopeResult.scope.assessmentPlan.status === "active";
      canMarkReportContributing =
        scopeResult.scope.assessmentPlan.teacherCanMarkItemsAsReportContributing;
      scoreComponents = scopeResult.scope.gradingPolicy.scoreComponents.map((component) => ({
        key: component.key,
        label: component.label,
      }));

      if (!hasActiveAssessmentPlan) {
        eligibilityNotes.push("An active assessment plan is required for this class and term.");
      }
    } else {
      eligibilityNotes.push(scopeResult.error);
    }
  } else {
    eligibilityNotes.push("Assign at least one class group before linking to the gradebook.");
  }

  const eligible =
    homework.status !== "draft" &&
    totalGraded > 0 &&
    hasActiveAssessmentPlan &&
    classGroupRows.length > 0;

  const marksWorkspacePath =
    firstClassGroupId && homework.subjectId
      ? `/teacher/marks/${firstClassGroupId}/${String(homework.subjectId)}`
      : null;

  return {
    ok: true,
    data: {
      homeworkId: String(homework._id),
      homeworkTitle: homework.title,
      homeworkType: homework.type,
      subjectId: String(homework.subjectId),
      subjectName: null,
      academicPeriodId: String(homework.academicPeriodId),
      eligible,
      eligibilityNotes,
      gradedSubmissionCount: totalGraded,
      canRecordMarks: true,
      canMarkReportContributing,
      classGroups: classGroupRows,
      scoreComponents,
      marksWorkspacePath,
    },
  };
}

export async function addStudioHomeworkToGradebook(
  context: TeacherMarksMutationContext,
  homeworkId: string,
  body: AddStudioToGradebookBody
): Promise<
  | { ok: true; data: StudioGradebookImportResult }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const homeworkResult = await loadOwnedHomework(context, homeworkId);
  if (!homeworkResult.ok) {
    return homeworkResult;
  }

  const homework = homeworkResult.homework;

  if (homework.status === "draft") {
    return {
      ok: false,
      error: "Publish the assignment before importing marks to the gradebook.",
      status: 400,
    };
  }

  const classGroupIds = new Set((homework.classGroupIds ?? []).map((id) => String(id)));
  if (!classGroupIds.has(body.classGroupId)) {
    return {
      ok: false,
      error: "Selected class group is not linked to this assignment.",
      status: 400,
    };
  }

  const scopeResult = await resolveTeacherMarksScope(context, {
    classGroupId: body.classGroupId,
    subjectId: String(homework.subjectId),
    academicPeriodId: String(homework.academicPeriodId),
  });

  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error, status: scopeResult.status };
  }

  const scope = scopeResult.scope;

  if (scope.assessmentPlan.status !== "active") {
    return {
      ok: false,
      error: "An active assessment plan is required before importing studio marks.",
      status: 400,
    };
  }

  const assessmentType = mapHomeworkTypeToAssessmentType(homework.type);
  const sourceType = mapHomeworkTypeToSourceType(homework.type);
  const requestedContributesToReport = body.contributionMode === "report";
  const componentKey =
    body.contributionMode === "report" ? body.componentKey ?? null : null;

  if (requestedContributesToReport && !scope.assessmentPlan.teacherCanCreateReportItems) {
    return {
      ok: false,
      error: "This assessment plan does not allow teachers to create report items.",
      status: 400,
    };
  }

  const contribution = resolveContributionFlags({
    componentKey,
    assessmentType,
    title: homework.title,
    requestedContributesToReport,
    assessmentPlan: scope.assessmentPlan,
    gradingPolicy: scope.gradingPolicy,
  });

  if (!contribution.ok) {
    return { ok: false, error: contribution.error, status: 400 };
  }

  const studentQuery: Record<string, unknown> = {
    schoolId: context.schoolId,
    classGroupId: scope.classGroupId,
    status: "active",
  };
  if (homework.targetStudentIds?.length) {
    studentQuery._id = { $in: homework.targetStudentIds };
  }

  const students = await Student.find(studentQuery).select("_id").lean();
  const studentIds = students.map((student) => student._id);

  const submissions = studentIds.length
    ? await Submission.find({
        homeworkId: homework._id,
        schoolId: context.schoolId,
        studentId: { $in: studentIds },
        status: "graded",
        score: { $ne: null },
      })
        .select("_id studentId score gradedAt")
        .lean()
    : [];

  if (submissions.length === 0) {
    return {
      ok: false,
      error: "No graded submissions with scores are available for this class group.",
      status: 400,
    };
  }

  let assessmentItem = (await AssessmentItem.findOne({
    schoolId: context.schoolId,
    sourceRefType: STUDIO_HOMEWORK_SOURCE_REF_TYPE,
    sourceRefId: homework._id,
    classGroupId: scope.classGroupId,
    subjectId: scope.subjectId,
  }).lean()) as IAssessmentItem | null;

  if (assessmentItem && !canMutateAssessmentItem(assessmentItem)) {
    return {
      ok: false,
      error: "Linked assessment item is locked and cannot be updated.",
      status: 400,
    };
  }

  const now = new Date();

  if (!assessmentItem) {
    const created = await AssessmentItem.create({
      schoolId: context.schoolId,
      academicPeriodId: scope.academicPeriodId,
      assessmentPlanId: toObjectId(scope.assessmentPlan._id),
      classGroupId: scope.classGroupId,
      gradeId: scope.gradeId,
      subjectId: scope.subjectId,
      teacherId: context.teacherId,
      title: homework.title,
      description: homework.instructions?.slice(0, 2000) ?? null,
      assessmentType,
      sourceType,
      sourceRefType: STUDIO_HOMEWORK_SOURCE_REF_TYPE,
      sourceRefId: homework._id,
      maxScore: homework.maxScore,
      dateAssigned: homework.publishedAt ?? homework.createdAt ?? null,
      dateDue: homework.dueDate ?? null,
      assessedAt: now,
      componentKey,
      contributesToReport: contribution.contributesToReport,
      contributionLockedByRule: contribution.contributionLockedByRule,
      missingPolicy: "exclude_from_average",
      visibility: "teacher_only",
      status: "open",
      createdBy: context.userId,
      updatedBy: context.userId,
    });

    assessmentItem = created.toObject() as IAssessmentItem;

    await recordAssessmentMarksAudit({
      schoolId: context.schoolId,
      actorUserId: context.userId,
      teacherId: context.teacherId,
      action: "assessment_item.created",
      entityType: "assessment_item",
      entityId: created._id as mongoose.Types.ObjectId,
      classGroupId: scope.classGroupId,
      subjectId: scope.subjectId,
      academicPeriodId: scope.academicPeriodId,
      assessmentPlanId: toObjectId(scope.assessmentPlan._id),
      metadata: {
        source: "teacher_studio",
        homeworkId: String(homework._id),
        sourceType,
        contributesToReport: contribution.contributesToReport,
      },
    });
  } else {
    await AssessmentItem.updateOne(
      { _id: assessmentItem._id },
      {
        $set: {
          title: homework.title,
          maxScore: homework.maxScore,
          assessmentType,
          sourceType,
          componentKey,
          contributesToReport: contribution.contributesToReport,
          contributionLockedByRule: contribution.contributionLockedByRule,
          assessedAt: now,
          updatedBy: context.userId,
        },
      }
    );

    assessmentItem = (await AssessmentItem.findById(assessmentItem._id).lean()) as IAssessmentItem;
  }

  const existingScores = await AssessmentScore.find({
    schoolId: context.schoolId,
    assessmentItemId: assessmentItem._id,
    studentId: { $in: submissions.map((submission) => submission.studentId) },
  })
    .select("studentId status")
    .lean();

  const existingByStudentId = new Map(
    existingScores.map((score) => [String(score.studentId), score])
  );

  let skippedLockedScores = 0;
  const operations: mongoose.AnyBulkWriteOperation[] = [];

  for (const submission of submissions) {
    const studentId = String(submission.studentId);
    const scoreValue = submission.score ?? null;
    const validation = validateScoreValue(scoreValue, assessmentItem.maxScore);
    if (!validation.ok) {
      return { ok: false, error: validation.error, status: 400 };
    }

    const existing = existingByStudentId.get(studentId);
    if (existing && !canMutateAssessmentScore(existing.status)) {
      skippedLockedScores += 1;
      continue;
    }

    const status = resolveScoreStatus(scoreValue);
    const percentage = computePercentage(scoreValue, assessmentItem.maxScore);

    operations.push({
      updateOne: {
        filter: {
          schoolId: context.schoolId,
          assessmentItemId: assessmentItem._id,
          studentId: submission.studentId,
        },
        update: {
          $set: {
            academicPeriodId: scope.academicPeriodId,
            assessmentPlanId: toObjectId(scope.assessmentPlan._id),
            classGroupId: scope.classGroupId,
            subjectId: scope.subjectId,
            teacherId: context.teacherId,
            score: scoreValue,
            maxScoreSnapshot: assessmentItem.maxScore,
            percentage,
            status,
            remarks: null,
            gradedAt: submission.gradedAt ?? now,
            recordedBy: context.userId,
            updatedBy: context.userId,
            sourceSubmissionId: submission._id,
          },
          $setOnInsert: {
            schoolId: context.schoolId,
            assessmentItemId: assessmentItem._id,
            studentId: submission.studentId,
          },
        },
        upsert: true,
      },
    });
  }

  if (operations.length > 0) {
    await AssessmentScore.bulkWrite(operations, { ordered: false });
  }

  const savedScores = (await AssessmentScore.find({
    schoolId: context.schoolId,
    assessmentItemId: assessmentItem._id,
    studentId: { $in: submissions.map((submission) => submission.studentId) },
  }).lean()) as Array<Parameters<typeof serializeAssessmentScore>[0]>;

  await recordAssessmentMarksAudit({
    schoolId: context.schoolId,
    actorUserId: context.userId,
    teacherId: context.teacherId,
    action: "studio.gradebook_linked",
    entityType: "assessment_item",
    entityId: assessmentItem._id as mongoose.Types.ObjectId,
    classGroupId: scope.classGroupId,
    subjectId: scope.subjectId,
    academicPeriodId: scope.academicPeriodId,
    assessmentPlanId: toObjectId(scope.assessmentPlan._id),
    metadata: {
      homeworkId: String(homework._id),
      importedScoreCount: operations.length,
      skippedLockedScores,
      contributesToReport: contribution.contributesToReport,
      componentKey,
    },
  });

  return {
    ok: true,
    data: {
      assessmentItem: serializeAssessmentItem(assessmentItem),
      importedScoreCount: operations.length,
      skippedLockedScores,
      marksWorkspacePath: `/teacher/marks/${body.classGroupId}/${String(homework.subjectId)}`,
    },
  };
}
