import mongoose from "mongoose";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AssessmentItem, type IAssessmentItem } from "@/models/AssessmentItem";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { AssessmentScore, type IAssessmentScore } from "@/models/AssessmentScore";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { SubjectResult } from "@/models/SubjectResult";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import {
  calculateSubjectResult,
  type CalculateSubjectResultOutput,
} from "@/lib/academics/assessment-engine/calculate-subject-result";
import {
  type CalculationAssessmentItem,
  type CalculationAssessmentScore,
} from "@/lib/academics/assessment-engine/calculate-component";
import { serializeGradingPolicy } from "@/lib/academics/assessment-engine/grading-policy-service";
import { serializeAssessmentPlan } from "@/lib/academics/assessment-engine/assessment-plan-service";
import type {
  AcademicGradingPolicyDTO,
  AssessmentItemDTO,
  AssessmentPlanDTO,
  AssessmentScoreDTO,
  ComponentRule,
  ScoreComponent,
  TeacherGradebookComponentItemSummary,
  TeacherGradebookComponentSummary,
  TeacherGradebookReadiness,
  TeacherGradebookStudentPreview,
  TeacherGradebookStudentRow,
  TeacherGradebookStudentScoreCell,
  TeacherGradebookV2DTO,
} from "@/types/academics/assessment-engine";

export type TeacherGradebookAccessContext = {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  isAdmin: boolean;
};

export type GetTeacherGradebookV2Options = {
  classGroupId: string;
  subjectId: string;
  academicPeriodId?: string | null;
};

function toObjectIdOrNull(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
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

export function serializeAssessmentItem(
  item: IAssessmentItem | Record<string, unknown>
): AssessmentItemDTO {
  const row = item as IAssessmentItem;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    academicPeriodId: String(row.academicPeriodId),
    assessmentPlanId: String(row.assessmentPlanId),
    classGroupId: String(row.classGroupId),
    gradeId: String(row.gradeId),
    subjectId: String(row.subjectId),
    subjectOfferingId: row.subjectOfferingId ? String(row.subjectOfferingId) : null,
    teacherId: String(row.teacherId),
    title: row.title,
    description: row.description ?? null,
    assessmentType: row.assessmentType,
    sourceType: row.sourceType,
    sourceRefType: row.sourceRefType ?? null,
    sourceRefId: row.sourceRefId ? String(row.sourceRefId) : null,
    maxScore: row.maxScore,
    dateAssigned: row.dateAssigned ?? null,
    dateDue: row.dateDue ?? null,
    assessedAt: row.assessedAt ?? null,
    componentKey: row.componentKey ?? null,
    contributesToReport: row.contributesToReport ?? false,
    contributionLockedByRule: row.contributionLockedByRule ?? false,
    missingPolicy: row.missingPolicy,
    visibility: row.visibility,
    status: row.status,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeAssessmentScore(
  score: IAssessmentScore | Record<string, unknown>
): AssessmentScoreDTO {
  const row = score as IAssessmentScore;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    academicPeriodId: String(row.academicPeriodId),
    assessmentItemId: String(row.assessmentItemId),
    assessmentPlanId: String(row.assessmentPlanId),
    classGroupId: String(row.classGroupId),
    subjectId: String(row.subjectId),
    studentId: String(row.studentId),
    teacherId: String(row.teacherId),
    score: row.score ?? null,
    maxScoreSnapshot: row.maxScoreSnapshot,
    percentage: row.percentage ?? null,
    status: row.status,
    remarks: row.remarks ?? null,
    gradedAt: row.gradedAt ?? null,
    recordedBy: row.recordedBy ? String(row.recordedBy) : null,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    sourceSubmissionId: row.sourceSubmissionId ? String(row.sourceSubmissionId) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function ruleForComponent(componentKey: string, rules: ComponentRule[]): ComponentRule {
  return (
    rules.find((rule) => rule.componentKey === componentKey) ?? {
      componentKey,
      contributionMode: "average_all",
    }
  );
}

function itemBelongsToComponent(
  item: CalculationAssessmentItem,
  component: ScoreComponent
): boolean {
  if (item.componentKey) {
    return item.componentKey === component.key;
  }
  if (component.allowedAssessmentTypes.length === 0) {
    return false;
  }
  return component.allowedAssessmentTypes.includes(item.assessmentType);
}

function isIncludedByRule(
  item: CalculationAssessmentItem,
  component: ScoreComponent,
  rule: ComponentRule
): boolean {
  if (!itemBelongsToComponent(item, component)) return false;

  if (rule.contributionMode === "teacher_selected") {
    return item.contributesToReport || item.contributionLockedByRule;
  }

  if (rule.contributionMode === "fixed_required_item") {
    const matchesType =
      rule.requiredAssessmentTypes?.includes(item.assessmentType) ?? false;
    const matchesLabel = rule.requiredItemLabels?.includes(item.title) ?? false;
    return matchesType || matchesLabel;
  }

  return true;
}

function hasRecordedScore(score?: CalculationAssessmentScore) {
  return (
    score != null &&
    score.score != null &&
    score.status !== "missing" &&
    score.status !== "draft"
  );
}

export function mapAssessmentItemToCalculationItem(
  item: AssessmentItemDTO
): CalculationAssessmentItem {
  return {
    id: item._id,
    componentKey: item.componentKey,
    assessmentType: item.assessmentType,
    title: item.title,
    maxScore: item.maxScore,
    contributesToReport: item.contributesToReport,
    contributionLockedByRule: item.contributionLockedByRule,
    missingPolicy: item.missingPolicy,
  };
}

export function buildTeacherSelectedItemIdsByComponent(
  items: AssessmentItemDTO[],
  scoreComponents: ScoreComponent[],
  componentRules: ComponentRule[]
): Record<string, string[]> {
  const selected: Record<string, string[]> = {};

  for (const component of scoreComponents) {
    const rule = ruleForComponent(component.key, componentRules);
    if (rule.contributionMode !== "teacher_selected") continue;

    selected[component.key] = items
      .filter((item) => {
        const calcItem = mapAssessmentItemToCalculationItem(item);
        return (
          isIncludedByRule(calcItem, component, rule) &&
          (item.contributesToReport || item.contributionLockedByRule)
        );
      })
      .map((item) => item._id);
  }

  return selected;
}

function toStudentPreview(result: CalculateSubjectResultOutput): TeacherGradebookStudentPreview {
  return {
    finalScore: result.finalScore,
    roundedFinalScore: result.roundedFinalScore,
    gradeLabel: result.gradeLabel,
    gradePoint: result.gradePoint,
    isPassed: result.isPassed,
    blocked: result.blocked,
    issueCount: result.issues.length,
    missingRequiredItems: result.missingRequiredItems,
  };
}

export function buildTeacherGradebookComponentSummaries(input: {
  scoreComponents: ScoreComponent[];
  componentRules: ComponentRule[];
  items: AssessmentItemDTO[];
  scores: AssessmentScoreDTO[];
  studentIds: string[];
}): TeacherGradebookComponentSummary[] {
  const { scoreComponents, componentRules, items, scores, studentIds } = input;
  const scoresByStudentItem = new Map<string, CalculationAssessmentScore>();

  for (const score of scores) {
    scoresByStudentItem.set(`${score.studentId}:${score.assessmentItemId}`, {
      assessmentItemId: score.assessmentItemId,
      score: score.score,
      status: score.status,
    });
  }

  return [...scoreComponents]
    .sort((a, b) => a.order - b.order)
    .map((component) => {
      const rule = ruleForComponent(component.key, componentRules);
      const eligibleItems = items.filter((item) =>
        itemBelongsToComponent(mapAssessmentItemToCalculationItem(item), component)
      );

      const componentItems: TeacherGradebookComponentItemSummary[] = eligibleItems.map((item) => {
        const calcItem = mapAssessmentItemToCalculationItem(item);
        const includedByRule = isIncludedByRule(calcItem, component, rule);
        let scoredStudentCount = 0;
        let missingStudentCount = 0;

        for (const studentId of studentIds) {
          const score = scoresByStudentItem.get(`${studentId}:${item._id}`);
          if (hasRecordedScore(score)) {
            scoredStudentCount += 1;
          } else {
            missingStudentCount += 1;
          }
        }

        return {
          assessmentItemId: item._id,
          title: item.title,
          assessmentType: item.assessmentType,
          maxScore: item.maxScore,
          contributesToReport: item.contributesToReport,
          contributionLockedByRule: item.contributionLockedByRule,
          status: item.status,
          scoredStudentCount,
          missingStudentCount,
          includedByRule,
        };
      });

      const contributingItems = componentItems.filter((item) => item.includedByRule);
      const contributingItemCount = contributingItems.length;

      let studentsFullyScored = 0;
      for (const studentId of studentIds) {
        const allScored =
          contributingItems.length > 0 &&
          contributingItems.every((item) => {
            const score = scoresByStudentItem.get(`${studentId}:${item.assessmentItemId}`);
            return hasRecordedScore(score);
          });
        if (allScored) studentsFullyScored += 1;
      }

      const issues: TeacherGradebookComponentSummary["issues"] = [];

      if (component.required && eligibleItems.length === 0) {
        issues.push({
          code: "MISSING_REQUIRED_COMPONENT_ITEMS",
          message: `Required component "${component.label}" has no assessment items yet.`,
          severity: "error",
        });
      }

      if (rule.contributionMode === "teacher_selected") {
        if (rule.minItems != null && contributingItemCount < rule.minItems) {
          issues.push({
            code: "INSUFFICIENT_SELECTED_ITEMS",
            message: `Select at least ${rule.minItems} contributing items for "${component.label}".`,
            severity: "error",
          });
        }
        if (rule.maxItems != null && contributingItemCount > rule.maxItems) {
          issues.push({
            code: "TOO_MANY_SELECTED_ITEMS",
            message: `At most ${rule.maxItems} contributing items are allowed for "${component.label}".`,
            severity: "error",
          });
        }
      }

      if (rule.contributionMode === "best_n") {
        const bestN = rule.bestN ?? 1;
        if (contributingItemCount < bestN) {
          issues.push({
            code: "INSUFFICIENT_BEST_N_ITEMS",
            message: `"${component.label}" needs at least ${bestN} eligible items for Best N.`,
            severity: "warning",
          });
        }
      }

      if (rule.contributionMode === "fixed_required_item") {
        const hasCriteria =
          (rule.requiredAssessmentTypes?.length ?? 0) > 0 ||
          (rule.requiredItemLabels?.length ?? 0) > 0;
        if (!hasCriteria) {
          issues.push({
            code: "MISSING_FIXED_ITEM_CRITERIA",
            message: `"${component.label}" fixed-item rule is missing required assessment types.`,
            severity: "error",
          });
        } else if (contributingItemCount === 0) {
          issues.push({
            code: "MISSING_REQUIRED_FIXED_ITEM",
            message: `"${component.label}" still needs the required assessment item.`,
            severity: "error",
          });
        }
      }

      const ready = !issues.some((issue) => issue.severity === "error");

      return {
        componentKey: component.key,
        label: component.label,
        weight: component.weight,
        required: component.required,
        contributionMode: rule.contributionMode,
        rule,
        eligibleItemCount: eligibleItems.length,
        contributingItemCount,
        items: componentItems,
        studentsExpected: studentIds.length,
        studentsFullyScored,
        ready,
        issues,
      };
    });
}

export function buildTeacherGradebookReadiness(input: {
  assessmentPlan: AssessmentPlanDTO | null;
  gradingPolicy: AcademicGradingPolicyDTO | null;
  componentSummary: TeacherGradebookComponentSummary[];
  assessmentItems: AssessmentItemDTO[];
  assessmentScores: AssessmentScoreDTO[];
  studentCount: number;
}): TeacherGradebookReadiness {
  const {
    assessmentPlan,
    gradingPolicy,
    componentSummary,
    assessmentItems,
    assessmentScores,
    studentCount,
  } = input;

  const issues: TeacherGradebookReadiness["issues"] = [];
  const checklist: TeacherGradebookReadiness["checklist"] = [];

  const hasAssessmentPlan = Boolean(assessmentPlan);
  const assessmentPlanActive = assessmentPlan?.status === "active";
  const hasGradingPolicy = Boolean(gradingPolicy);

  checklist.push({
    key: "active_plan",
    label: "Assessment plan active",
    complete: assessmentPlanActive,
  });

  const requiredComponentsReady = componentSummary
    .filter((entry) => entry.required)
    .every((entry) => entry.eligibleItemCount > 0);
  checklist.push({
    key: "required_items",
    label: "Required assessment items created",
    complete: requiredComponentsReady,
  });

  const requiredScoresReady = componentSummary.every(
    (entry) => entry.studentsFullyScored === studentCount || entry.contributingItemCount === 0
  );
  checklist.push({
    key: "required_scores",
    label: "Required scores entered",
    complete: studentCount === 0 ? false : requiredScoresReady,
  });

  const invalidScoreCount = assessmentScores.filter((score) => {
    const item = assessmentItems.find((entry) => entry._id === score.assessmentItemId);
    if (!item || score.score == null) return false;
    return score.score < 0 || score.score > item.maxScore;
  }).length;

  checklist.push({
    key: "valid_scores",
    label: "No invalid scores",
    complete: invalidScoreCount === 0,
  });

  const missingScoreCount = assessmentScores.filter(
    (score) => score.score == null || score.status === "missing" || score.status === "draft"
  ).length;

  const draftAssessmentItemCount = assessmentItems.filter(
    (item) => item.status === "draft"
  ).length;

  if (!hasAssessmentPlan) {
    issues.push({
      code: "NO_ASSESSMENT_PLAN",
      message: "No active assessment plan applies to this class group and term.",
      severity: "error",
    });
  } else if (!assessmentPlanActive) {
    issues.push({
      code: "ASSESSMENT_PLAN_NOT_ACTIVE",
      message: "The linked assessment plan is not active yet.",
      severity: "error",
    });
  }

  if (!hasGradingPolicy) {
    issues.push({
      code: "NO_GRADING_POLICY",
      message: "No grading policy is linked to this assessment plan.",
      severity: "error",
    });
  }

  for (const component of componentSummary) {
    for (const issue of component.issues) {
      issues.push(issue);
    }
  }

  if (invalidScoreCount > 0) {
    issues.push({
      code: "INVALID_SCORES",
      message: `${invalidScoreCount} score(s) are outside the allowed range.`,
      severity: "error",
    });
  }

  const blockedSubmission =
    issues.some((issue) => issue.severity === "error") ||
    !assessmentPlanActive ||
    !hasGradingPolicy;

  const canSubmit =
    !blockedSubmission &&
    studentCount > 0 &&
    checklist.every((entry) => entry.complete);

  return {
    assessmentPlanActive,
    hasAssessmentPlan,
    hasGradingPolicy,
    studentsExpected: studentCount,
    assessmentItemCount: assessmentItems.length,
    draftAssessmentItemCount,
    missingScoreCount,
    invalidScoreCount,
    blockedSubmission,
    canSubmit,
    checklist,
    issues,
  };
}

export function buildTeacherGradebookStudentRows(input: {
  students: Array<{
    _id: string;
    name: string;
    admissionNo?: string | null;
  }>;
  assessmentItems: AssessmentItemDTO[];
  assessmentScores: AssessmentScoreDTO[];
  scoreComponents: ScoreComponent[];
  componentRules: ComponentRule[];
  gradingPolicy: AcademicGradingPolicyDTO | null;
  subjectResultsByStudentId: Map<
    string,
    { _id: string; status: string; preview?: TeacherGradebookStudentPreview | null }
  >;
}): TeacherGradebookStudentRow[] {
  const {
    students,
    assessmentItems,
    assessmentScores,
    scoreComponents,
    componentRules,
    gradingPolicy,
    subjectResultsByStudentId,
  } = input;

  const scoresByStudentItem = new Map<string, AssessmentScoreDTO>();
  for (const score of assessmentScores) {
    scoresByStudentItem.set(`${score.studentId}:${score.assessmentItemId}`, score);
  }

  const teacherSelectedItemIdsByComponent = buildTeacherSelectedItemIdsByComponent(
    assessmentItems,
    scoreComponents,
    componentRules
  );

  return students.map((student) => {
    const scoreCells: TeacherGradebookStudentScoreCell[] = assessmentItems.map((item) => {
      const score = scoresByStudentItem.get(`${student._id}:${item._id}`);
      return {
        assessmentItemId: item._id,
        score: score?.score ?? null,
        maxScore: score?.maxScoreSnapshot ?? item.maxScore,
        percentage: score?.percentage ?? null,
        status: score?.status ?? "draft",
      };
    });

    let preview: TeacherGradebookStudentPreview | null = null;
    if (gradingPolicy) {
      const studentScores: CalculationAssessmentScore[] = assessmentScores
        .filter((score) => score.studentId === student._id)
        .map((score) => ({
          assessmentItemId: score.assessmentItemId,
          score: score.score,
          status: score.status,
        }));

      preview = toStudentPreview(
        calculateSubjectResult({
          scoreComponents,
          componentRules,
          items: assessmentItems.map(mapAssessmentItemToCalculationItem),
          scores: studentScores,
          teacherSelectedItemIdsByComponent,
          gradeBoundaries: gradingPolicy.gradeBoundaries,
          passMark: gradingPolicy.passMark,
          roundingRule: gradingPolicy.roundingRule,
        })
      );
    }

    const subjectResult = subjectResultsByStudentId.get(student._id);

    return {
      _id: student._id,
      name: student.name,
      admissionNo: student.admissionNo ?? null,
      scores: scoreCells,
      preview,
      subjectResultId: subjectResult?._id ?? null,
      subjectResultStatus:
        (subjectResult?.status as TeacherGradebookStudentRow["subjectResultStatus"]) ?? null,
    };
  });
}

export async function assertTeacherGradebookAccess(
  context: TeacherGradebookAccessContext,
  input: { classGroupId: mongoose.Types.ObjectId; subjectId: mongoose.Types.ObjectId; academicPeriodId: mongoose.Types.ObjectId }
) {
  if (context.isAdmin) {
    return { ok: true as const };
  }

  const assignment = await TeacherAssignment.findOne({
    schoolId: context.schoolId,
    teacherId: context.teacherId,
    classGroupId: input.classGroupId,
    subjectId: input.subjectId,
    academicPeriodId: input.academicPeriodId,
    status: "active",
  })
    .select("_id")
    .lean();

  if (!assignment) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }

  return { ok: true as const };
}

export async function getTeacherGradebookV2(
  context: TeacherGradebookAccessContext,
  options: GetTeacherGradebookV2Options
): Promise<
  | { ok: true; data: TeacherGradebookV2DTO }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const classGroupObjId = toObjectIdOrNull(options.classGroupId);
  const subjectObjId = toObjectIdOrNull(options.subjectId);

  if (!classGroupObjId || !subjectObjId) {
    return { ok: false, error: "Invalid class group or subject", status: 400 };
  }

  const [classGroup, subject] = await Promise.all([
    ClassGroup.findOne({ _id: classGroupObjId, schoolId: context.schoolId })
      .select("_id name gradeId")
      .lean(),
    Subject.findOne({ _id: subjectObjId, schoolId: context.schoolId })
      .select("_id name")
      .lean(),
  ]);

  if (!classGroup || !subject) {
    return { ok: false, error: "Class group or subject not found", status: 404 };
  }

  const periodQuery: Record<string, unknown> = { schoolId: context.schoolId };
  if (options.academicPeriodId) {
    const periodObjId = toObjectIdOrNull(options.academicPeriodId);
    if (!periodObjId) {
      return { ok: false, error: "Invalid academic period", status: 400 };
    }
    periodQuery._id = periodObjId;
  } else {
    periodQuery.isCurrent = true;
  }

  const period = await AcademicPeriod.findOne(periodQuery)
    .select("_id yearLabel term isCurrent")
    .lean();

  const grade = classGroup.gradeId
    ? await Grade.findById(classGroup.gradeId).select("_id name").lean()
    : null;

  const classGroupRef = {
    _id: String(classGroup._id),
    name: classGroup.name,
    label: grade ? `${grade.name} ${classGroup.name}`.trim() : classGroup.name,
    gradeId: grade ? String(grade._id) : String(classGroup.gradeId ?? ""),
    gradeName: grade?.name ?? "",
  };

  const subjectRef = {
    _id: String(subject._id),
    name: subject.name,
  };

  const academicPeriodRef = period
    ? {
        _id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
        isCurrent: period.isCurrent,
      }
    : null;

  const studentsRaw = await Student.find({
    schoolId: context.schoolId,
    classGroupId: classGroupObjId,
    status: "active",
  })
    .select("_id firstName lastName middleName admissionNo")
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  const studentRowsBase = studentsRaw.map((student) => ({
    _id: String(student._id),
    name: formatStudentName(student),
    admissionNo: student.admissionNo ?? null,
  }));

  if (!period) {
    return {
      ok: true,
      data: {
        classGroup: classGroupRef,
        subject: subjectRef,
        academicPeriod: null,
        assessmentPlan: null,
        gradingPolicy: null,
        students: studentRowsBase.map((student) => ({
          ...student,
          scores: [],
          preview: null,
          subjectResultId: null,
          subjectResultStatus: null,
        })),
        assessmentItems: [],
        assessmentScores: [],
        componentSummary: [],
        readiness: buildTeacherGradebookReadiness({
          assessmentPlan: null,
          gradingPolicy: null,
          componentSummary: [],
          assessmentItems: [],
          assessmentScores: [],
          studentCount: studentRowsBase.length,
        }),
      },
    };
  }

  const access = await assertTeacherGradebookAccess(context, {
    classGroupId: classGroupObjId,
    subjectId: subjectObjId,
    academicPeriodId: period._id as mongoose.Types.ObjectId,
  });

  if (!access.ok) {
    return { ok: false, error: access.error, status: access.status };
  }

  const assessmentPlanDoc = classGroup.gradeId
    ? await AssessmentPlan.findOne({
        schoolId: context.schoolId,
        academicPeriodId: period._id,
        appliesToGradeId: classGroup.gradeId,
        appliesToClassGroupIds: classGroupObjId,
        status: "active",
      }).lean()
    : null;

  const assessmentPlan = assessmentPlanDoc
    ? serializeAssessmentPlan(assessmentPlanDoc)
    : null;

  const gradingPolicyDoc = assessmentPlan
    ? await AcademicGradingPolicy.findOne({
        _id: new mongoose.Types.ObjectId(assessmentPlan.gradingPolicyId),
        schoolId: context.schoolId,
      }).lean()
    : null;

  const gradingPolicy = gradingPolicyDoc
    ? serializeGradingPolicy(gradingPolicyDoc)
    : null;

  const itemQuery: Record<string, unknown> = {
    schoolId: context.schoolId,
    academicPeriodId: period._id,
    classGroupId: classGroupObjId,
    subjectId: subjectObjId,
    status: { $ne: "archived" },
  };

  if (assessmentPlan) {
    itemQuery.assessmentPlanId = new mongoose.Types.ObjectId(assessmentPlan._id);
  }

  if (!context.isAdmin) {
    itemQuery.teacherId = context.teacherId;
  }

  const [itemDocs, subjectResultDocs] = await Promise.all([
    AssessmentItem.find(itemQuery).sort({ assessedAt: -1, createdAt: -1 }).lean(),
    assessmentPlan
      ? SubjectResult.find({
          schoolId: context.schoolId,
          academicPeriodId: period._id,
          classGroupId: classGroupObjId,
          subjectId: subjectObjId,
          assessmentPlanId: new mongoose.Types.ObjectId(assessmentPlan._id),
        })
          .select("_id studentId status finalScore roundedFinalScore gradeLabel isPassed")
          .lean()
      : Promise.resolve([]),
  ]);

  const assessmentItems = itemDocs.map((item) => serializeAssessmentItem(item));
  const itemIds = assessmentItems.map((item) => item._id);
  const studentIds = studentRowsBase.map((student) => student._id);

  const scoreDocs =
    itemIds.length > 0 && studentIds.length > 0
      ? await AssessmentScore.find({
          schoolId: context.schoolId,
          academicPeriodId: period._id,
          classGroupId: classGroupObjId,
          subjectId: subjectObjId,
          assessmentItemId: {
            $in: itemIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          studentId: {
            $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        }).lean()
      : [];

  const assessmentScores = scoreDocs.map((score) => serializeAssessmentScore(score));

  const scoreComponents = gradingPolicy?.scoreComponents ?? [];
  const componentRules = assessmentPlan?.componentRules ?? [];

  const componentSummary = buildTeacherGradebookComponentSummaries({
    scoreComponents,
    componentRules,
    items: assessmentItems,
    scores: assessmentScores,
    studentIds,
  });

  const subjectResultsByStudentId = new Map<
    string,
    { _id: string; status: string; preview?: TeacherGradebookStudentPreview | null }
  >();
  for (const result of subjectResultDocs) {
    subjectResultsByStudentId.set(String(result.studentId), {
      _id: String(result._id),
      status: result.status,
      preview: {
        finalScore: result.finalScore,
        roundedFinalScore: result.roundedFinalScore,
        gradeLabel: result.gradeLabel,
        gradePoint: null,
        isPassed: result.isPassed,
        blocked: false,
        issueCount: 0,
        missingRequiredItems: [],
      },
    });
  }

  const students = buildTeacherGradebookStudentRows({
    students: studentRowsBase,
    assessmentItems,
    assessmentScores,
    scoreComponents,
    componentRules,
    gradingPolicy,
    subjectResultsByStudentId,
  });

  const readiness = buildTeacherGradebookReadiness({
    assessmentPlan,
    gradingPolicy,
    componentSummary,
    assessmentItems,
    assessmentScores,
    studentCount: students.length,
  });

  return {
    ok: true,
    data: {
      classGroup: classGroupRef,
      subject: subjectRef,
      academicPeriod: academicPeriodRef,
      assessmentPlan,
      gradingPolicy,
      students,
      assessmentItems,
      assessmentScores,
      componentSummary,
      readiness,
    },
  };
}
