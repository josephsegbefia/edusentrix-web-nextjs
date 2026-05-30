/**
 * Subject-level assessment breakdown for Student Academic Profile (Slice 8).
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §12, Slice 8
 */

import mongoose from "mongoose";
import { CONTRIBUTION_MODE_LABELS } from "@/constants/academics/assessment-engine";
import { mapLegacySubjectGradeToProfileRow } from "@/lib/academics/profile/buildLegacyAcademicProfileFallback";
import { findBestStudentReportCardForProfile } from "@/lib/academics/profile/buildProfileFromReportCard";
import { mapSubjectResultComponentToProfile } from "@/lib/academics/profile/buildProfileFromSubjectResults";
import {
  asSnapshotRecord,
  readSnapshotString,
} from "@/lib/academics/profile/snapshot-field-utils";
import { buildStudentReportCardViewData } from "@/lib/academics/reporting/build-student-report-card-view";
import { loadStudentReportCardViewContext } from "@/lib/academics/reporting/load-student-report-card";
import { serializeAssessmentItem } from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { AssessmentScore } from "@/models/AssessmentScore";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { SubjectGrade, type ISubjectGrade } from "@/models/SubjectGrade";
import { SubjectResult, type ISubjectResult } from "@/models/SubjectResult";
import type {
  ContributionMode,
  SubjectResultComponentSnapshot,
} from "@/types/academics/assessment-engine";
import type {
  AcademicProfileAssessmentEvidenceItemDTO,
  AcademicProfileDataSource,
  AcademicProfileScoreComponentDTO,
  AcademicProfileSubjectBreakdownDTO,
  AcademicProfileVisibilityMode,
} from "@/types/academics/student-academic-profile";

type IdLike = string | mongoose.Types.ObjectId;

function toObjectId(value: IdLike) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

export function describeContributionMode(
  mode: string | null | undefined,
  componentLabel: string
): string {
  const label = mode ? (CONTRIBUTION_MODE_LABELS[mode as ContributionMode] ?? mode) : "Rule";

  switch (mode) {
    case "teacher_selected":
      return `Included by teacher selection for ${componentLabel}.`;
    case "best_n":
      return `Included by rule for ${componentLabel}: best scores used (${label}).`;
    case "average_all":
      return `Included by rule for ${componentLabel}: average of all eligible scores.`;
    case "fixed_required_item":
      return `Included by rule for ${componentLabel}: required fixed items.`;
    case "weighted_items":
      return `Included by rule for ${componentLabel}: weighted item scores.`;
    case "drop_lowest":
      return `Excluded by rule for ${componentLabel}: lowest score dropped.`;
    case "latest_n":
      return `Included by rule for ${componentLabel}: latest scores used.`;
    default:
      return `Calculated for ${componentLabel} using ${label}.`;
  }
}

export function buildExclusionReason(input: {
  isCounted: boolean;
  isMissing: boolean;
  contributesToReport: boolean;
  calculationMode: string | null;
  componentLabel: string;
}): string | null {
  if (input.isCounted) {
    return null;
  }
  if (input.isMissing) {
    return "Score not recorded.";
  }
  if (!input.contributesToReport) {
    return "Marked as not contributing to the report.";
  }
  if (input.calculationMode === "drop_lowest") {
    return `Excluded by rule for ${input.componentLabel}: lowest score dropped.`;
  }
  if (input.calculationMode === "teacher_selected") {
    return "Not selected by the teacher for this component.";
  }
  return `Excluded by rule for ${input.componentLabel}.`;
}

export function mapEngineItemsToEvidence(input: {
  items: Array<{
    _id: string;
    title: string;
    assessmentType: string;
    componentKey?: string | null;
    contributesToReport: boolean;
    maxScore: number;
  }>;
  scoresByItemId: Map<string, { score: number | null; maxScoreSnapshot: number; percentage: number | null; status: string }>;
  components: SubjectResultComponentSnapshot[];
  componentLabelByKey: Map<string, string>;
  missingRequiredLabels: string[];
}): AcademicProfileAssessmentEvidenceItemDTO[] {
  const includedIds = new Set(
    input.components.flatMap((component) => component.includedAssessmentItemIds ?? [])
  );
  const modeByItemId = new Map<string, string | null>();

  for (const component of input.components) {
    for (const id of component.includedAssessmentItemIds ?? []) {
      modeByItemId.set(id, component.calculationMode);
    }
    for (const id of component.excludedAssessmentItemIds ?? []) {
      if (!modeByItemId.has(id)) {
        modeByItemId.set(id, component.calculationMode);
      }
    }
  }

  const evidence: AcademicProfileAssessmentEvidenceItemDTO[] = input.items.map((item) => {
    const score = input.scoresByItemId.get(item._id);
    const componentKey = item.componentKey ?? "general";
    const componentLabel = input.componentLabelByKey.get(componentKey) ?? componentKey;
    const isMissing =
      !score ||
      score.score == null ||
      score.status === "missing" ||
      score.status === "draft";
    const isCounted = includedIds.has(item._id);

    return {
      assessmentItemId: item._id,
      title: item.title,
      assessmentType: item.assessmentType,
      componentKey,
      componentLabel,
      rawScore: score?.score ?? null,
      rawMaxScore: score?.maxScoreSnapshot ?? item.maxScore,
      rawPercentage: score?.percentage ?? null,
      isCounted,
      isMissing,
      contributionMode: modeByItemId.get(item._id) ?? null,
      exclusionReason: buildExclusionReason({
        isCounted,
        isMissing,
        contributesToReport: item.contributesToReport,
        calculationMode: modeByItemId.get(item._id) ?? null,
        componentLabel,
      }),
    };
  });

  for (const label of input.missingRequiredLabels) {
    if (evidence.some((row) => row.title === label)) continue;
    evidence.push({
      assessmentItemId: `missing:${label}`,
      title: label,
      assessmentType: "required",
      componentKey: "required",
      componentLabel: "Required",
      rawScore: null,
      rawMaxScore: null,
      rawPercentage: null,
      isCounted: false,
      isMissing: true,
      contributionMode: null,
      exclusionReason: "Required score missing.",
    });
  }

  return evidence.sort((a, b) => a.title.localeCompare(b.title));
}

export function buildCalculationExplanation(input: {
  dataSource: AcademicProfileDataSource;
  components: SubjectResultComponentSnapshot[];
  policyName?: string | null;
  assessmentPlanName?: string | null;
  isOfficial: boolean;
}): string {
  const lines: string[] = [];

  if (input.policyName) {
    lines.push(`Grading policy: ${input.policyName}.`);
  }
  if (input.assessmentPlanName) {
    lines.push(`Assessment plan: ${input.assessmentPlanName}.`);
  }

  if (input.dataSource === "report_snapshot") {
    lines.push(
      input.isOfficial
        ? "Official released report card snapshot."
        : "Report card snapshot (not yet released to parents)."
    );
  } else if (input.dataSource === "subject_results") {
    lines.push("Calculated from submitted assessment engine subject results.");
  } else if (input.dataSource === "legacy") {
    lines.push("Legacy gradebook breakdown (CA/exam or saved components).");
  }

  for (const component of input.components) {
    lines.push(
      `${component.label} (${component.weight}%): ${describeContributionMode(
        component.calculationMode,
        component.label
      )}`
    );
  }

  return lines.join(" ");
}

function mapSnapshotComponentsToProfile(
  snapshotComponents: SubjectResultComponentSnapshot[]
): AcademicProfileScoreComponentDTO[] {
  return snapshotComponents.map((component) =>
    mapSubjectResultComponentToProfile(component, "snapshot")
  );
}

async function buildBreakdownFromReportCardSnapshot(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId: string;
  subjectId: string;
  visibilityMode: AcademicProfileVisibilityMode;
}): Promise<AcademicProfileSubjectBreakdownDTO | null> {
  const card = await findBestStudentReportCardForProfile({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: input.academicPeriodId,
    visibilityMode: input.visibilityMode,
  });

  if (!card) {
    return null;
  }

  const snapshotRow = (card.subjectResultsSnapshot as Array<Record<string, unknown>>).find(
    (row) => readSnapshotString(row.subjectId) === input.subjectId
  );

  if (!snapshotRow) {
    return null;
  }

  const viewContext = await loadStudentReportCardViewContext(card);
  const view = buildStudentReportCardViewData(card, viewContext);
  const viewSubject = view.subjects.find((row) => row.subjectId === input.subjectId);

  const snapshotComponents = Array.isArray(snapshotRow.components)
    ? (snapshotRow.components as SubjectResultComponentSnapshot[])
    : [];

  const componentLabelByKey = new Map(
    snapshotComponents.map((component) => [component.componentKey, component.label])
  );

  const itemIds = [
    ...new Set(
      snapshotComponents.flatMap((component) => [
        ...(component.includedAssessmentItemIds ?? []),
        ...(component.excludedAssessmentItemIds ?? []),
      ])
    ),
  ].filter((id) => mongoose.Types.ObjectId.isValid(id));

  const [itemDocs, scoreDocs, subject] = await Promise.all([
    itemIds.length
      ? AssessmentItem.find({
          _id: { $in: itemIds.map((id) => toObjectId(id)) },
          schoolId: input.schoolId,
        }).lean()
      : Promise.resolve([]),
    itemIds.length
      ? AssessmentScore.find({
          schoolId: input.schoolId,
          studentId: input.studentId,
          academicPeriodId: toObjectId(input.academicPeriodId),
          subjectId: toObjectId(input.subjectId),
          assessmentItemId: { $in: itemIds.map((id) => toObjectId(id)) },
        }).lean()
      : Promise.resolve([]),
    Subject.findOne({ _id: input.subjectId, schoolId: input.schoolId })
      .select("name")
      .lean(),
  ]);

  const items = itemDocs.map((doc) => serializeAssessmentItem(doc));
  const scoresByItemId = new Map(
    scoreDocs.map((score) => [
      String(score.assessmentItemId),
      {
        score: score.score ?? null,
        maxScoreSnapshot: score.maxScoreSnapshot,
        percentage: score.percentage ?? null,
        status: String(score.status),
      },
    ])
  );

  const gradingPolicySnapshot = asSnapshotRecord(card.gradingPolicySnapshot);
  const assessmentPlanSnapshot = asSnapshotRecord(card.assessmentPlanSnapshot);
  const isReleased = card.status === "released";

  return {
    studentId: String(input.studentId),
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
    subjectName: viewSubject?.subjectName ?? subject?.name ?? "Subject",
    dataSource: "report_snapshot",
    isOfficial: isReleased,
    components: mapSnapshotComponentsToProfile(snapshotComponents),
    items:
      items.length > 0
        ? mapEngineItemsToEvidence({
            items,
            scoresByItemId,
            components: snapshotComponents,
            componentLabelByKey,
            missingRequiredLabels: [],
          })
        : [],
    calculationExplanation: buildCalculationExplanation({
      dataSource: "report_snapshot",
      components: snapshotComponents,
      policyName: readSnapshotString(gradingPolicySnapshot?.name),
      assessmentPlanName: readSnapshotString(assessmentPlanSnapshot?.name),
      isOfficial: isReleased,
    }),
  };
}

async function buildBreakdownFromSubjectResult(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId: string;
  subjectId: string;
  classGroupId: mongoose.Types.ObjectId;
}): Promise<AcademicProfileSubjectBreakdownDTO | null> {
  const subjectResult = (await SubjectResult.findOne({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: toObjectId(input.academicPeriodId),
    subjectId: toObjectId(input.subjectId),
    classGroupId: input.classGroupId,
  })
    .sort({ updatedAt: -1 })
    .lean()) as ISubjectResult | null;

  if (!subjectResult) {
    return null;
  }

  const [subject, policy, plan, itemDocs, scoreDocs] = await Promise.all([
    Subject.findOne({ _id: input.subjectId, schoolId: input.schoolId }).select("name code").lean(),
    AcademicGradingPolicy.findById(subjectResult.gradingPolicyId).select("name scoreComponents").lean(),
    AssessmentPlan.findById(subjectResult.assessmentPlanId).select("name componentRules").lean(),
    AssessmentItem.find({
      schoolId: input.schoolId,
      academicPeriodId: toObjectId(input.academicPeriodId),
      classGroupId: input.classGroupId,
      subjectId: toObjectId(input.subjectId),
      assessmentPlanId: subjectResult.assessmentPlanId,
      status: { $ne: "archived" },
    })
      .sort({ assessedAt: -1, createdAt: -1 })
      .lean(),
    AssessmentScore.find({
      schoolId: input.schoolId,
      studentId: input.studentId,
      academicPeriodId: toObjectId(input.academicPeriodId),
      classGroupId: input.classGroupId,
      subjectId: toObjectId(input.subjectId),
      assessmentPlanId: subjectResult.assessmentPlanId,
    }).lean(),
  ]);

  const components = subjectResult.components ?? [];
  const componentLabelByKey = new Map(
    components.map((component) => [component.componentKey, component.label])
  );

  const items = itemDocs.map((doc) => serializeAssessmentItem(doc));
  const scoresByItemId = new Map(
    scoreDocs.map((score) => [
      String(score.assessmentItemId),
      {
        score: score.score ?? null,
        maxScoreSnapshot: score.maxScoreSnapshot,
        percentage: score.percentage ?? null,
        status: String(score.status),
      },
    ])
  );

  const isOfficial =
    subjectResult.status === "approved" || subjectResult.status === "locked";

  return {
    studentId: String(input.studentId),
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
    subjectName: subject?.name ?? "Subject",
    dataSource: "subject_results",
    isOfficial,
    components: components.map((component) =>
      mapSubjectResultComponentToProfile(component, subjectResult.status)
    ),
    items: mapEngineItemsToEvidence({
      items,
      scoresByItemId,
      components,
      componentLabelByKey,
      missingRequiredLabels: subjectResult.missingRequiredItems ?? [],
    }),
    calculationExplanation: buildCalculationExplanation({
      dataSource: "subject_results",
      components,
      policyName: policy?.name ?? null,
      assessmentPlanName: plan?.name ?? null,
      isOfficial,
    }),
  };
}

async function buildBreakdownFromLegacyGrade(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId: string;
  subjectId: string;
}): Promise<AcademicProfileSubjectBreakdownDTO | null> {
  const grade = await SubjectGrade.findOne({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: toObjectId(input.academicPeriodId),
    subjectId: toObjectId(input.subjectId),
  })
    .sort({ updatedAt: -1 })
    .populate("subjectId", "name code")
    .lean();

  if (!grade) {
    return null;
  }

  const subjectDoc = grade.subjectId as { _id?: IdLike; name?: string; code?: string | null } | null;
  const subjectId = subjectDoc?._id
    ? String(subjectDoc._id)
    : String(grade.subjectId);

  const profileRow = mapLegacySubjectGradeToProfileRow(
    grade as ISubjectGrade,
    {
      subjectId,
      subjectName: subjectDoc?.name ?? "Subject",
      subjectCode: subjectDoc?.code ?? null,
      teacherId: null,
      teacherName: null,
    }
  );

  const items: AcademicProfileAssessmentEvidenceItemDTO[] = [];

  if (grade.components?.length) {
    for (const [index, component] of grade.components.entries()) {
      items.push({
        assessmentItemId: `legacy-component-${index}`,
        title: component.label,
        assessmentType: "legacy",
        componentKey: slugComponentKey(component.label, index),
        componentLabel: component.label,
        rawScore: component.score ?? null,
        rawMaxScore: component.maxScore ?? null,
        rawPercentage: component.percentage ?? null,
        isCounted: true,
        isMissing: false,
        contributionMode: "legacy",
        exclusionReason: null,
      });
    }
  } else {
    items.push(
      {
        assessmentItemId: "legacy-ca",
        title: "CA",
        assessmentType: "legacy",
        componentKey: "ca",
        componentLabel: "CA",
        rawScore: grade.caTotal ?? null,
        rawMaxScore: grade.caMaxTotal ?? null,
        rawPercentage: grade.caPercentage ?? null,
        isCounted: true,
        isMissing: false,
        contributionMode: "legacy",
        exclusionReason: null,
      },
      {
        assessmentItemId: "legacy-exam",
        title: "Exam",
        assessmentType: "legacy",
        componentKey: "exam",
        componentLabel: "Exam",
        rawScore: grade.examScore ?? null,
        rawMaxScore: grade.examMaxScore ?? null,
        rawPercentage: grade.examPercentage ?? null,
        isCounted: true,
        isMissing: false,
        contributionMode: "legacy",
        exclusionReason: null,
      }
    );
  }

  return {
    studentId: String(input.studentId),
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
    subjectName: profileRow.subjectName,
    dataSource: "legacy",
    isOfficial: false,
    components: profileRow.components,
    items,
    calculationExplanation: buildCalculationExplanation({
      dataSource: "legacy",
      components: componentsFromLegacyProfile(profileRow.components),
      isOfficial: false,
    }),
  };
}

function slugComponentKey(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || `component_${index + 1}`;
}

function componentsFromLegacyProfile(
  components: AcademicProfileScoreComponentDTO[]
): SubjectResultComponentSnapshot[] {
  return components.map((component) => ({
    componentKey: component.componentKey,
    label: component.label,
    weight: component.weight,
    rawScore: component.rawScore ?? 0,
    rawMaxScore: component.rawMaxScore ?? 0,
    rawPercentage: component.rawPercentage ?? 0,
    weightedScore: component.weightedScore ?? 0,
    includedAssessmentItemIds: [],
    excludedAssessmentItemIds: [],
    calculationMode: "average_all",
  }));
}

export async function buildSubjectAcademicProfileBreakdown(input: {
  schoolId: IdLike;
  studentId: IdLike;
  academicPeriodId: string;
  subjectId: string;
  visibilityMode?: AcademicProfileVisibilityMode;
}): Promise<AcademicProfileSubjectBreakdownDTO | null> {
  const schoolObjectId = toObjectId(input.schoolId);
  const studentObjectId = toObjectId(input.studentId);
  const visibilityMode = input.visibilityMode ?? "admin";

  const student = await Student.findOne({
    _id: studentObjectId,
    schoolId: schoolObjectId,
  })
    .select("_id classGroupId")
    .lean();

  if (!student?.classGroupId) {
    return null;
  }

  const fromSnapshot = await buildBreakdownFromReportCardSnapshot({
    schoolId: schoolObjectId,
    studentId: studentObjectId,
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
    visibilityMode,
  });

  if (fromSnapshot) {
    return fromSnapshot;
  }

  const fromSubjectResult = await buildBreakdownFromSubjectResult({
    schoolId: schoolObjectId,
    studentId: studentObjectId,
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
    classGroupId: student.classGroupId as mongoose.Types.ObjectId,
  });

  if (fromSubjectResult) {
    return fromSubjectResult;
  }

  return buildBreakdownFromLegacyGrade({
    schoolId: schoolObjectId,
    studentId: studentObjectId,
    academicPeriodId: input.academicPeriodId,
    subjectId: input.subjectId,
  });
}
