import mongoose from "mongoose";
import { z } from "zod";
import type {
  AssessmentEngineAssessmentType,
  AssessmentItemDTO,
  AssessmentScoreStatus,
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
  MUTABLE_ASSESSMENT_ITEM_STATUSES,
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

export type StudioAssessmentScoreWriteInput = {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  assessmentItemId: mongoose.Types.ObjectId;
  assessmentPlanId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  score: number | null;
  maxScoreSnapshot: number;
  percentage: number | null;
  status: AssessmentScoreStatus;
  gradedAt: Date | null;
  recordedBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  sourceSubmissionId: mongoose.Types.ObjectId;
};

export type StudioAssessmentScoreWriteResult =
  | { outcome: "written" }
  | { outcome: "locked" }
  | { outcome: "conflict" };

export type StudioAssessmentItemUpdateResult =
  | { outcome: "updated"; item: IAssessmentItem }
  | { outcome: "conflict"; currentStatus: IAssessmentItem["status"] }
  | { outcome: "not_found" };

export type StudioSubmissionScoreInput = {
  studentId: mongoose.Types.ObjectId;
  score: number | null;
};

export function validateStudioSubmissionSet(
  submissions: readonly StudioSubmissionScoreInput[],
  maxScore: number
):
  | { ok: true }
  | { ok: false; status: 400 | 409; error: string; studentId?: string } {
  const studentIds = new Set<string>();

  for (const submission of submissions) {
    const studentId = String(submission.studentId);
    if (studentIds.has(studentId)) {
      return {
        ok: false,
        status: 409,
        error: "Multiple submissions were found for one student; gradebook import is ambiguous.",
        studentId,
      };
    }
    studentIds.add(studentId);

    const validation = validateScoreValue(submission.score, maxScore);
    if (!validation.ok) {
      return { ok: false, status: 400, error: validation.error, studentId };
    }
  }

  return { ok: true };
}

export function buildStudioGradebookAuditMetadata(input: {
  homeworkId: mongoose.Types.ObjectId;
  assessmentItemId: mongoose.Types.ObjectId;
  selectedSubmissionCount: number;
  importedScoreCount: number;
  skippedLockedScores: number;
  conflicts: string[];
  contributesToReport: boolean;
  componentKey: string | null;
}) {
  return {
    operation: "studio_gradebook_link",
    outcome: input.conflicts.length > 0 ? "partial_failure" : "completed",
    homeworkId: String(input.homeworkId),
    assessmentItemId: String(input.assessmentItemId),
    selectedSubmissionCount: input.selectedSubmissionCount,
    importedScoreCount: input.importedScoreCount,
    skippedLockedScores: input.skippedLockedScores,
    writtenScoreCount: input.importedScoreCount,
    skippedLockedScoreCount: input.skippedLockedScores,
    conflictCount: input.conflicts.length,
    conflicts: input.conflicts,
    contributesToReport: input.contributesToReport,
    componentKey: input.componentKey,
  };
}

export async function updateStudioAssessmentItem(input: {
  schoolId: mongoose.Types.ObjectId;
  item: Pick<IAssessmentItem, "_id" | "schoolId" | "status">;
  update: Record<string, unknown>;
}): Promise<StudioAssessmentItemUpdateResult> {
  const updated = (await AssessmentItem.findOneAndUpdate(
    {
      _id: input.item._id,
      schoolId: input.schoolId,
      status: { $in: MUTABLE_ASSESSMENT_ITEM_STATUSES },
    },
    { $set: input.update },
    { new: true }
  ).lean()) as IAssessmentItem | null;

  if (updated) {
    return { outcome: "updated", item: updated };
  }

  const current = await AssessmentItem.findOne({
    _id: input.item._id,
    schoolId: input.schoolId,
  })
    .select("status")
    .lean();

  if (!current) {
    return { outcome: "not_found" };
  }

  return { outcome: "conflict", currentStatus: current.status };
}

/**
 * Apply one Studio score only while the canonical score remains unlocked.
 * This deliberately has no implicit retry: the Studio import has no durable
 * handoff receipt, so an ambiguous/duplicate write must be surfaced as a
 * conflict rather than treated as exactly-once.
 */
export async function writeStudioAssessmentScore(
  input: StudioAssessmentScoreWriteInput
): Promise<StudioAssessmentScoreWriteResult> {
  const identityFilter = {
    schoolId: input.schoolId,
    assessmentItemId: input.assessmentItemId,
    studentId: input.studentId,
  };

  try {
    const result = await AssessmentScore.updateOne(
      {
        ...identityFilter,
        status: { $ne: "locked" },
      },
      {
        $set: {
          academicPeriodId: input.academicPeriodId,
          assessmentPlanId: input.assessmentPlanId,
          classGroupId: input.classGroupId,
          subjectId: input.subjectId,
          teacherId: input.teacherId,
          score: input.score,
          maxScoreSnapshot: input.maxScoreSnapshot,
          percentage: input.percentage,
          status: input.status,
          remarks: null,
          gradedAt: input.gradedAt,
          recordedBy: input.recordedBy,
          updatedBy: input.updatedBy,
          sourceSubmissionId: input.sourceSubmissionId,
        },
        $setOnInsert: identityFilter,
      },
      { upsert: true }
    );

    if (result.matchedCount > 0 || result.upsertedCount > 0) {
      return { outcome: "written" };
    }
  } catch (error: unknown) {
    if ((error as { code?: number }).code !== 11000) {
      throw error;
    }
    // A duplicate-key race is intentionally not retried: this path has no
    // durable operation receipt and cannot safely distinguish a duplicate
    // request from a competing score mutation.
  }

  const current = await AssessmentScore.findOne(identityFilter).select("status").lean();
  return current?.status === "locked"
    ? { outcome: "locked" }
    : { outcome: "conflict" };
}

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
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 }
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

  const submissionValidation = validateStudioSubmissionSet(
    submissions.map((submission) => ({
      studentId: submission.studentId,
      score: submission.score ?? null,
    })),
    homework.maxScore
  );
  if (!submissionValidation.ok) {
    return {
      ok: false,
      error: submissionValidation.studentId
        ? `${submissionValidation.error} Student: ${submissionValidation.studentId}`
        : submissionValidation.error,
      status: submissionValidation.status,
    };
  }

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
    const itemUpdate = await updateStudioAssessmentItem({
      schoolId: context.schoolId,
      item: assessmentItem,
      update: {
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
    });

    if (itemUpdate.outcome === "not_found") {
      return { ok: false, error: "Assessment item not found", status: 404 };
    }
    if (itemUpdate.outcome === "conflict") {
      return {
        ok: false,
        error: "Linked assessment item changed state and could not be updated. Retry the import.",
        status: 409,
      };
    }

    assessmentItem = itemUpdate.item;
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
  let importedScoreCount = 0;
  const failedWrites: string[] = [];

  for (const submission of submissions) {
    const studentId = String(submission.studentId);
    const scoreValue = submission.score ?? null;

    const existing = existingByStudentId.get(studentId);
    if (existing && !canMutateAssessmentScore(existing.status)) {
      skippedLockedScores += 1;
      continue;
    }

    const status = resolveScoreStatus(scoreValue);
    const percentage = computePercentage(scoreValue, assessmentItem.maxScore);

    let writeResult: StudioAssessmentScoreWriteResult;
    try {
      writeResult = await writeStudioAssessmentScore({
        schoolId: context.schoolId,
        academicPeriodId: scope.academicPeriodId,
        assessmentItemId: assessmentItem._id as mongoose.Types.ObjectId,
        assessmentPlanId: toObjectId(scope.assessmentPlan._id),
        classGroupId: scope.classGroupId,
        subjectId: scope.subjectId,
        studentId: submission.studentId,
        teacherId: context.teacherId,
        score: scoreValue,
        maxScoreSnapshot: assessmentItem.maxScore,
        percentage,
        status,
        gradedAt: submission.gradedAt ?? now,
        recordedBy: context.userId,
        updatedBy: context.userId,
        sourceSubmissionId: submission._id,
      });
    } catch {
      failedWrites.push(`${studentId} (write failed)`);
      continue;
    }

    if (writeResult.outcome === "written") {
      importedScoreCount += 1;
    } else if (writeResult.outcome === "locked") {
      skippedLockedScores += 1;
    } else {
      failedWrites.push(studentId);
    }
  }

  if (failedWrites.length > 0) {
    await recordAssessmentMarksAudit({
      schoolId: context.schoolId,
      actorUserId: context.userId,
      teacherId: context.teacherId,
      action: "studio.gradebook_link_conflict",
      entityType: "assessment_item",
      entityId: assessmentItem._id as mongoose.Types.ObjectId,
      classGroupId: scope.classGroupId,
      subjectId: scope.subjectId,
      academicPeriodId: scope.academicPeriodId,
      assessmentPlanId: toObjectId(scope.assessmentPlan._id),
      metadata: buildStudioGradebookAuditMetadata({
        homeworkId: homework._id,
        assessmentItemId: assessmentItem._id as mongoose.Types.ObjectId,
        selectedSubmissionCount: submissions.length,
        importedScoreCount,
        skippedLockedScores,
        conflicts: failedWrites,
        contributesToReport: contribution.contributesToReport,
        componentKey,
      }),
    });

    return {
      ok: false,
      error: `${failedWrites.length} score write(s) were not applied; ${importedScoreCount} prior score(s) may already have been saved. Conflicts: ${failedWrites.join(", ")}`,
      status: 409,
    };
  }

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
    metadata: buildStudioGradebookAuditMetadata({
      homeworkId: homework._id,
      assessmentItemId: assessmentItem._id as mongoose.Types.ObjectId,
      selectedSubmissionCount: submissions.length,
      importedScoreCount,
      skippedLockedScores,
      conflicts: [],
      contributesToReport: contribution.contributesToReport,
      componentKey,
    }),
  });

  return {
    ok: true,
    data: {
      assessmentItem: serializeAssessmentItem(assessmentItem),
      importedScoreCount,
      skippedLockedScores,
      marksWorkspacePath: `/teacher/marks/${body.classGroupId}/${String(homework.subjectId)}`,
    },
  };
}
