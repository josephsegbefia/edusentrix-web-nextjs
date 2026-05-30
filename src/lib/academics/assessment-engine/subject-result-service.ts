import mongoose from "mongoose";
import { z } from "zod";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentScore } from "@/models/AssessmentScore";
import { Student } from "@/models/Student";
import { SubjectResult, type ISubjectResult } from "@/models/SubjectResult";
import { calculateSubjectResult } from "@/lib/academics/assessment-engine/calculate-subject-result";
import { recordAssessmentMarksAudit } from "@/lib/academics/assessment-engine/assessment-marks-audit";
import { resolveTeacherMarksScope } from "@/lib/academics/assessment-engine/assessment-marks-context";
import {
  buildTeacherGradebookComponentSummaries,
  buildTeacherGradebookReadiness,
  buildTeacherSelectedItemIdsByComponent,
  mapAssessmentItemToCalculationItem,
  serializeAssessmentItem,
  serializeAssessmentScore,
  type TeacherGradebookAccessContext,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import type {
  AcademicGradingPolicyDTO,
  AssessmentItemDTO,
  AssessmentPlanDTO,
  AssessmentScoreDTO,
  ComponentRule,
  ScoreComponent,
  SubjectResultDTO,
  SubjectResultPreviewDTO,
  SubjectResultPreviewStudentDTO,
  SubjectResultStatus,
  SubjectResultSubmitSummaryDTO,
  TeacherGradebookAcademicPeriodRef,
  TeacherGradebookClassGroupRef,
  TeacherGradebookComponentSummary,
  TeacherGradebookReadiness,
  TeacherGradebookSubjectRef,
} from "@/types/academics/assessment-engine";
import type { TeacherMarksScope } from "@/lib/academics/assessment-engine/assessment-marks-context";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

export const subjectResultScopeBodySchema = z.object({
  classGroupId: objectIdSchema,
  subjectId: objectIdSchema,
  academicPeriodId: objectIdSchema.optional(),
});

export type SubjectResultScopeBody = z.infer<typeof subjectResultScopeBodySchema>;

export type TeacherSubjectResultContext = TeacherGradebookAccessContext & {
  userId: mongoose.Types.ObjectId;
};

const LOCKED_SUBJECT_RESULT_STATUSES = new Set<SubjectResultStatus>([
  "submitted",
  "approved",
  "locked",
]);

export function parseSubjectResultScopeBody(
  body: unknown
): { ok: true; data: SubjectResultScopeBody } | { ok: false; error: string } {
  const parsed = subjectResultScopeBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid subject result payload",
    };
  }
  return { ok: true, data: parsed.data };
}

function formatStudentName(student: {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
}) {
  return [student.lastName, student.firstName, student.middleName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function serializeSubjectResult(doc: ISubjectResult | Record<string, unknown>): SubjectResultDTO {
  const row = doc as ISubjectResult;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    academicPeriodId: String(row.academicPeriodId),
    assessmentPlanId: String(row.assessmentPlanId),
    gradingPolicyId: String(row.gradingPolicyId),
    classGroupId: String(row.classGroupId),
    gradeId: String(row.gradeId),
    subjectId: String(row.subjectId),
    studentId: String(row.studentId),
    teacherId: String(row.teacherId),
    components: row.components ?? [],
    finalScore: row.finalScore,
    roundedFinalScore: row.roundedFinalScore,
    gradeLabel: row.gradeLabel,
    gradePoint: row.gradePoint ?? null,
    descriptor: row.descriptor ?? null,
    isPassed: row.isPassed,
    subjectPosition: row.subjectPosition ?? null,
    totalStudentsForSubject: row.totalStudentsForSubject ?? null,
    subjectRemark: row.subjectRemark ?? null,
    missingRequiredItems: row.missingRequiredItems ?? [],
    sourceAssessmentItemIds: (row.sourceAssessmentItemIds ?? []).map(String),
    calculationSnapshot: row.calculationSnapshot ?? undefined,
    status: row.status,
    submittedBy: row.submittedBy ? String(row.submittedBy) : null,
    submittedAt: row.submittedAt ?? null,
    returnedBy: row.returnedBy ? String(row.returnedBy) : null,
    returnedAt: row.returnedAt ?? null,
    returnReason: row.returnReason ?? null,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    approvedAt: row.approvedAt ?? null,
    lockedAt: row.lockedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type SubjectResultPreviewDataset = {
  classGroupRef: TeacherGradebookClassGroupRef;
  subjectRef: TeacherGradebookSubjectRef;
  academicPeriodRef: TeacherGradebookAcademicPeriodRef;
  students: Array<{ _id: string; name: string; admissionNo?: string | null }>;
  assessmentItems: AssessmentItemDTO[];
  assessmentScores: AssessmentScoreDTO[];
  scoreComponents: ScoreComponent[];
  componentRules: ComponentRule[];
  gradingPolicy: AcademicGradingPolicyDTO;
  assessmentPlan: AssessmentPlanDTO;
  scope: TeacherMarksScope;
  existingResultsByStudentId: Map<
    string,
    { _id: string; status: SubjectResultStatus; locked: boolean }
  >;
  readiness: TeacherGradebookReadiness;
  componentSummary: TeacherGradebookComponentSummary[];
};

async function loadMarksDataset(
  context: TeacherGradebookAccessContext,
  body: SubjectResultScopeBody
): Promise<
  | { ok: true; data: SubjectResultPreviewDataset }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const scopeResult = await resolveTeacherMarksScope(context, body);
  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error, status: scopeResult.status };
  }

  const { scope } = scopeResult;
  const classGroupRef: TeacherGradebookClassGroupRef = {
    _id: String(scope.classGroupId),
    name: scope.classGroup.name,
    label: `${scope.grade.name} ${scope.classGroup.name}`.trim(),
    gradeId: String(scope.gradeId),
    gradeName: scope.grade.name,
  };
  const subjectRef: TeacherGradebookSubjectRef = {
    _id: String(scope.subjectId),
    name: scope.subject.name,
  };
  const academicPeriodRef: TeacherGradebookAcademicPeriodRef = {
    _id: String(scope.academicPeriodId),
    yearLabel: scope.academicPeriod.yearLabel,
    term: scope.academicPeriod.term,
    isCurrent: scope.academicPeriod.isCurrent,
  };

  const studentsRaw = await Student.find({
    schoolId: context.schoolId,
    classGroupId: scope.classGroupId,
    status: "active",
  })
    .select("_id firstName lastName middleName admissionNo")
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  const studentRows = studentsRaw.map((student) => ({
    _id: String(student._id),
    name: formatStudentName(student),
    admissionNo: student.admissionNo ?? null,
  }));

  const itemQuery: Record<string, unknown> = {
    schoolId: context.schoolId,
    academicPeriodId: scope.academicPeriodId,
    classGroupId: scope.classGroupId,
    subjectId: scope.subjectId,
    assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
    status: { $ne: "archived" },
  };

  if (!context.isAdmin) {
    itemQuery.teacherId = context.teacherId;
  }

  const [itemDocs, subjectResultDocs] = await Promise.all([
    AssessmentItem.find(itemQuery).sort({ assessedAt: -1, createdAt: -1 }).lean(),
    SubjectResult.find({
      schoolId: context.schoolId,
      academicPeriodId: scope.academicPeriodId,
      classGroupId: scope.classGroupId,
      subjectId: scope.subjectId,
      assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
    })
      .select("_id studentId status")
      .lean(),
  ]);

  const assessmentItems = itemDocs.map((item) => serializeAssessmentItem(item));
  const itemIds = assessmentItems.map((item) => item._id);
  const studentIds = studentRows.map((student) => student._id);

  const scoreDocs =
    itemIds.length > 0 && studentIds.length > 0
      ? await AssessmentScore.find({
          schoolId: context.schoolId,
          academicPeriodId: scope.academicPeriodId,
          classGroupId: scope.classGroupId,
          subjectId: scope.subjectId,
          assessmentItemId: {
            $in: itemIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          studentId: {
            $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        }).lean()
      : [];

  const assessmentScores = scoreDocs.map((score) => serializeAssessmentScore(score));
  const scoreComponents = scope.gradingPolicy.scoreComponents;
  const componentRules = scope.assessmentPlan.componentRules;

  const componentSummary = buildTeacherGradebookComponentSummaries({
    scoreComponents,
    componentRules,
    items: assessmentItems,
    scores: assessmentScores,
    studentIds,
  });

  const readiness = buildTeacherGradebookReadiness({
    assessmentPlan: scope.assessmentPlan,
    gradingPolicy: scope.gradingPolicy,
    componentSummary,
    assessmentItems,
    assessmentScores,
    studentCount: studentRows.length,
  });

  const existingResultsByStudentId = new Map<
    string,
    { _id: string; status: SubjectResultStatus; locked: boolean }
  >();
  for (const result of subjectResultDocs) {
    const status = result.status as SubjectResultStatus;
    existingResultsByStudentId.set(String(result.studentId), {
      _id: String(result._id),
      status,
      locked: LOCKED_SUBJECT_RESULT_STATUSES.has(status),
    });
  }

  return {
    ok: true,
    data: {
      classGroupRef,
      subjectRef,
      academicPeriodRef,
      students: studentRows,
      assessmentItems,
      assessmentScores,
      scoreComponents,
      componentRules,
      gradingPolicy: scope.gradingPolicy,
      assessmentPlan: scope.assessmentPlan,
      scope,
      existingResultsByStudentId,
      readiness,
      componentSummary,
    },
  };
}

export function buildSubjectResultPreviewStudents(
  input: SubjectResultPreviewDataset
): SubjectResultPreviewStudentDTO[] {
  const {
    students,
    assessmentItems,
    assessmentScores,
    scoreComponents,
    componentRules,
    gradingPolicy,
    existingResultsByStudentId,
  } = input;

  const teacherSelectedItemIdsByComponent = buildTeacherSelectedItemIdsByComponent(
    assessmentItems,
    scoreComponents,
    componentRules
  );

  const previewStudents = students.map((student) => {
    const studentScores = assessmentScores
      .filter((score) => score.studentId === student._id)
      .map((score) => ({
        assessmentItemId: score.assessmentItemId,
        score: score.score,
        status: score.status,
      }));

    const calculation = calculateSubjectResult({
      scoreComponents,
      componentRules,
      items: assessmentItems.map(mapAssessmentItemToCalculationItem),
      scores: studentScores,
      teacherSelectedItemIdsByComponent,
      gradeBoundaries: gradingPolicy.gradeBoundaries,
      passMark: gradingPolicy.passMark,
      roundingRule: gradingPolicy.roundingRule,
    });

    const existing = existingResultsByStudentId.get(student._id);

    return {
      studentId: student._id,
      name: student.name,
      admissionNo: student.admissionNo ?? null,
      components: calculation.components,
      finalScore: calculation.finalScore,
      roundedFinalScore: calculation.roundedFinalScore,
      gradeLabel: calculation.gradeLabel,
      gradePoint: calculation.gradePoint,
      descriptor: calculation.descriptor,
      isPassed: calculation.isPassed,
      blocked: calculation.blocked,
      issues: calculation.issues,
      missingRequiredItems: calculation.missingRequiredItems,
      subjectResultId: existing?._id ?? null,
      subjectResultStatus: existing?.status ?? null,
      locked: existing?.locked ?? false,
    };
  });

  const ranked = [...previewStudents]
    .filter((student) => !student.blocked)
    .sort((a, b) => b.roundedFinalScore - a.roundedFinalScore);

  const positionByStudentId = new Map<string, number>();
  ranked.forEach((student, index) => {
    positionByStudentId.set(student.studentId, index + 1);
  });

  return previewStudents.map((student) => ({
    ...student,
    subjectPosition: student.blocked ? null : positionByStudentId.get(student.studentId) ?? null,
  }));
}

export async function previewSubjectResults(
  context: TeacherGradebookAccessContext,
  body: SubjectResultScopeBody
): Promise<
  | { ok: true; data: SubjectResultPreviewDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const datasetResult = await loadMarksDataset(context, body);
  if (!datasetResult.ok) {
    return datasetResult;
  }

  const dataset = datasetResult.data;
  const students = buildSubjectResultPreviewStudents(dataset);

  return {
    ok: true,
    data: {
      classGroup: dataset.classGroupRef,
      subject: dataset.subjectRef,
      academicPeriod: dataset.academicPeriodRef,
      readiness: dataset.readiness,
      students,
      summary: {
        totalStudents: students.length,
        calculableStudents: students.filter((student) => !student.blocked).length,
        blockedStudents: students.filter((student) => student.blocked).length,
        lockedStudents: students.filter((student) => student.locked).length,
      },
    },
  };
}

export async function submitSubjectResults(
  context: TeacherSubjectResultContext,
  body: SubjectResultScopeBody
): Promise<
  | { ok: true; data: SubjectResultSubmitSummaryDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 }
> {
  const datasetResult = await loadMarksDataset(context, body);
  if (!datasetResult.ok) {
    return datasetResult;
  }

  const dataset = datasetResult.data;

  if (!dataset.readiness.canSubmit) {
    return {
      ok: false,
      error: "Complete all readiness requirements before submitting subject results.",
      status: 400,
    };
  }

  const previewStudents = buildSubjectResultPreviewStudents(dataset);
  const blockedStudents = previewStudents.filter((student) => student.blocked);
  if (blockedStudents.length > 0) {
    return {
      ok: false,
      error: `${blockedStudents.length} student(s) still have blocking calculation issues.`,
      status: 400,
    };
  }

  const lockedStudents = previewStudents.filter((student) => student.locked);
  if (lockedStudents.length > 0) {
    return {
      ok: false,
      error: `${lockedStudents.length} student result(s) are already submitted or locked.`,
      status: 409,
    };
  }

  const now = new Date();
  const totalStudentsForSubject = previewStudents.length;
  const subjectResultIds: string[] = [];

  for (const student of previewStudents) {
    const upserted = await SubjectResult.findOneAndUpdate(
      {
        schoolId: context.schoolId,
        academicPeriodId: dataset.scope.academicPeriodId,
        classGroupId: dataset.scope.classGroupId,
        subjectId: dataset.scope.subjectId,
        studentId: new mongoose.Types.ObjectId(student.studentId),
      },
      {
        $set: {
          assessmentPlanId: new mongoose.Types.ObjectId(dataset.assessmentPlan._id),
          gradingPolicyId: new mongoose.Types.ObjectId(dataset.gradingPolicy._id),
          gradeId: dataset.scope.gradeId,
          teacherId: context.teacherId,
          components: student.components,
          finalScore: student.finalScore,
          roundedFinalScore: student.roundedFinalScore,
          gradeLabel: student.gradeLabel,
          gradePoint: student.gradePoint,
          descriptor: student.descriptor,
          isPassed: student.isPassed,
          subjectPosition: student.subjectPosition ?? null,
          totalStudentsForSubject,
          missingRequiredItems: student.missingRequiredItems,
          sourceAssessmentItemIds: [
            ...new Set(student.components.flatMap((component) => component.includedAssessmentItemIds)),
          ].map((id) => new mongoose.Types.ObjectId(id)),
          calculationSnapshot: {
            previewedAt: now.toISOString(),
            issueCount: student.issues.length,
          },
          status: "submitted",
          submittedBy: context.userId,
          submittedAt: now,
          lockedAt: now,
          returnedBy: null,
          returnedAt: null,
          returnReason: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    subjectResultIds.push(String(upserted._id));
  }

  await recordAssessmentMarksAudit({
    schoolId: context.schoolId,
    actorUserId: context.userId,
    teacherId: context.teacherId,
    action: "subject_results.submitted",
    entityType: "subject_result_batch",
    classGroupId: dataset.scope.classGroupId,
    subjectId: dataset.scope.subjectId,
    academicPeriodId: dataset.scope.academicPeriodId,
    assessmentPlanId: new mongoose.Types.ObjectId(dataset.assessmentPlan._id),
    metadata: {
      subjectResultIds,
      submittedCount: subjectResultIds.length,
      classGroupId: String(dataset.scope.classGroupId),
      subjectId: String(dataset.scope.subjectId),
    },
  });

  return {
    ok: true,
    data: {
      submittedCount: subjectResultIds.length,
      skippedLockedCount: 0,
      subjectResultIds,
      status: "submitted",
    },
  };
}

export { serializeSubjectResult };
