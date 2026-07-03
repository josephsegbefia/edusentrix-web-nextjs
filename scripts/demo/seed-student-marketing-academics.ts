import dotenv from "dotenv";
import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { AssessmentScore } from "@/models/AssessmentScore";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { StudentReportCard } from "@/models/StudentReportCard";
import { Subject } from "@/models/Subject";
import { SubjectResult } from "@/models/SubjectResult";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { calculateSubjectResult } from "@/lib/academics/assessment-engine/calculate-subject-result";
import {
  mapAssessmentItemToCalculationItem,
  serializeAssessmentItem,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import type {
  AssessmentScoreStatus,
  ComponentRule,
  GradeBoundary,
  RoundingRule,
  ScoreComponent,
  SubjectResultComponentSnapshot,
} from "@/types/academics/assessment-engine";

dotenv.config({ path: ".env.local", quiet: true });

const STUDENT_ID = "6a23fd033941d9c3c3ef3c29";
const SOURCE_REF_TYPE = "marketing_video_seed";

type SubjectTarget = {
  total: number;
  classwork: number;
  exam: number;
};

const TARGETS_BY_SUBJECT: Record<string, SubjectTarget> = {
  science: { total: 88, classwork: 90, exam: 87.1 },
  "english language": { total: 84, classwork: 86, exam: 83.1 },
  mathematics: { total: 79, classwork: 81, exam: 78.1 },
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isObjectId(value: unknown): value is mongoose.Types.ObjectId {
  return value instanceof mongoose.Types.ObjectId;
}

function toObjectId(value: unknown, label: string) {
  if (isObjectId(value)) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  throw new Error(`Missing or invalid ${label}`);
}

function resolveTarget(subjectName: string, index: number): SubjectTarget {
  const explicit = TARGETS_BY_SUBJECT[normalize(subjectName)];
  if (explicit) return explicit;

  const fallbackTotals = [86, 82, 78, 74, 71, 68];
  const total = fallbackTotals[index] ?? 75;
  return {
    total,
    classwork: Math.min(100, total + 2),
    exam: Math.max(0, Number(((total - 0.3 * (total + 2)) / 0.7).toFixed(1))),
  };
}

function componentForKind(components: ScoreComponent[], kind: "classwork" | "exam") {
  const needles =
    kind === "exam"
      ? ["exam", "final", "mock"]
      : ["classwork", "classroom", "homework", "quiz", "assignment", "project"];

  return (
    components.find((component) => needles.includes(normalize(component.key))) ??
    components.find((component) =>
      needles.some((needle) => normalize(component.label).includes(needle))
    ) ??
    null
  );
}

function ruleForComponent(componentKey: string, rules: ComponentRule[]): ComponentRule {
  return rules.find((rule) => rule.componentKey === componentKey) ?? {
    componentKey,
    contributionMode: "average_all",
  };
}

function resolveGrade(
  score: number,
  boundaries: GradeBoundary[]
): { label: string; point: number | null; descriptor: string | null } {
  const boundary = boundaries.find(
    (entry) => score >= entry.minPercentage && score <= entry.maxPercentage
  );
  return {
    label: boundary?.gradeLabel ?? "",
    point: boundary?.gradePoint ?? null,
    descriptor: boundary?.descriptor ?? null,
  };
}

function scoreStatus(score: number | null): AssessmentScoreStatus {
  return score == null ? "missing" : "recorded";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME || undefined,
  });

  const student = await Student.findById(STUDENT_ID)
    .select("_id schoolId classGroupId gradeId firstName lastName")
    .lean();
  if (!student) throw new Error("Student not found");

  const schoolId = toObjectId(student.schoolId, "student.schoolId");
  const classGroupId = toObjectId(student.classGroupId, "student.classGroupId");
  const gradeId = toObjectId(student.gradeId, "student.gradeId");
  const studentId = toObjectId(student._id, "student._id");

  const academicPeriod = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("_id yearLabel term")
    .lean();
  if (!academicPeriod) throw new Error("No current academic period found");
  const academicPeriodId = toObjectId(academicPeriod._id, "academicPeriod._id");

  const assessmentPlan = await AssessmentPlan.findOne({
    schoolId,
    academicPeriodId,
    appliesToClassGroupIds: classGroupId,
    status: "active",
  }).lean();
  if (!assessmentPlan) throw new Error("No active assessment plan for this class group");

  const gradingPolicyDoc = await AcademicGradingPolicy.findOne({
    _id: assessmentPlan.gradingPolicyId,
    schoolId,
  }).lean();
  if (!gradingPolicyDoc) throw new Error("Grading policy not found for active assessment plan");

  const gradingPolicy = {
    _id: String(gradingPolicyDoc._id),
    name: gradingPolicyDoc.name,
    scoreComponents: gradingPolicyDoc.scoreComponents as ScoreComponent[],
    gradeBoundaries: gradingPolicyDoc.gradeBoundaries as GradeBoundary[],
    passMark: gradingPolicyDoc.passMark,
    roundingRule: gradingPolicyDoc.roundingRule as RoundingRule,
  };

  const scoreComponents = gradingPolicy.scoreComponents ?? [];
  const classworkComponent = componentForKind(scoreComponents, "classwork");
  const examComponent = componentForKind(scoreComponents, "exam");
  if (!classworkComponent || !examComponent) {
    throw new Error("Could not resolve classwork and exam components from the grading policy");
  }

  const assignments = await TeacherAssignment.find({
    schoolId,
    classGroupId,
    academicPeriodId,
    status: "active",
  })
    .select("_id subjectId subjectOfferingId teacherId")
    .lean();

  const latestCard = await StudentReportCard.findOne({
    schoolId,
    studentId,
    academicPeriodId,
    status: { $in: ["released", "approved", "compiled"] },
  })
    .sort({ releasedAt: -1, updatedAt: -1 })
    .lean();

  const classGroup = await ClassGroup.findById(classGroupId)
    .select("_id subjectIds homeroomTeacherId")
    .lean();

  const fallbackTeacher =
    (classGroup?.homeroomTeacherId
      ? await Teacher.findOne({ _id: classGroup.homeroomTeacherId, schoolId })
          .select("_id")
          .lean()
      : null) ??
    (await Teacher.findOne({ schoolId, status: "active" }).select("_id").lean());

  if (!fallbackTeacher && assignments.length === 0) {
    throw new Error("No teacher assignment or active school teacher found for fallback scoring");
  }

  const allSchoolSubjects = await Subject.find({ schoolId })
    .select("_id name code")
    .lean();
  const allSubjectsByName = new Map(
    allSchoolSubjects.map((subject) => [normalize(subject.name), subject])
  );

  const snapshotSubjectNames = Array.isArray(latestCard?.subjectResultsSnapshot)
    ? (latestCard.subjectResultsSnapshot as Array<{ subjectName?: string }>)
        .map((row) => row.subjectName)
        .filter((name): name is string => !!name?.trim())
    : [];

  const fallbackSubjectIds =
    classGroup?.subjectIds?.length
      ? classGroup.subjectIds.map(String)
      : snapshotSubjectNames
          .map((name) => allSubjectsByName.get(normalize(name))?._id)
          .filter((id): id is mongoose.Types.ObjectId => !!id)
          .map(String);

  const subjectRows =
    assignments.length > 0
      ? assignments.map((assignment) => ({
          subjectId: toObjectId(assignment.subjectId, "assignment.subjectId"),
          subjectOfferingId: assignment.subjectOfferingId ?? null,
          teacherId: toObjectId(assignment.teacherId, "assignment.teacherId"),
        }))
      : fallbackSubjectIds.map((subjectId) => ({
          subjectId: new mongoose.Types.ObjectId(subjectId),
          subjectOfferingId: null,
          teacherId: toObjectId(fallbackTeacher?._id, "fallbackTeacher._id"),
        }));

  const subjectIds = [...new Set(subjectRows.map((row) => String(row.subjectId)))];
  const subjects = await Subject.find({
    _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
    schoolId,
  })
    .select("_id name code")
    .lean();

  const subjectsById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const now = new Date();
  const updates: Array<Record<string, unknown>> = [];

  for (const [index, subjectRow] of subjectRows.entries()) {
    const subjectId = toObjectId(subjectRow.subjectId, "subjectRow.subjectId");
    const teacherId = toObjectId(subjectRow.teacherId, "subjectRow.teacherId");
    const subject = subjectsById.get(String(subjectId));
    if (!subject) continue;

    const target = resolveTarget(subject.name, index);
    const itemSpecs = [
      {
        title: `Marketing Demo ${classworkComponent.label} 1`,
        component: classworkComponent,
        assessmentType: classworkComponent.allowedAssessmentTypes[0] ?? "classwork",
        score: Math.max(0, target.classwork - 2),
      },
      {
        title: `Marketing Demo ${classworkComponent.label} 2`,
        component: classworkComponent,
        assessmentType: classworkComponent.allowedAssessmentTypes[1] ?? "homework",
        score: Math.min(100, target.classwork + 1),
      },
      {
        title: `Marketing Demo ${classworkComponent.label} 3`,
        component: classworkComponent,
        assessmentType: classworkComponent.allowedAssessmentTypes[2] ?? "quiz",
        score: target.classwork,
      },
      {
        title: `Marketing Demo ${examComponent.label}`,
        component: examComponent,
        assessmentType: examComponent.allowedAssessmentTypes[0] ?? "exam",
        score: target.exam,
      },
    ];

    const itemDocs = [];
    for (const spec of itemSpecs) {
      const filter = {
        schoolId,
        academicPeriodId,
        assessmentPlanId: assessmentPlan._id,
        classGroupId,
        subjectId,
        sourceRefType: SOURCE_REF_TYPE,
        componentKey: spec.component.key,
        title: spec.title,
      };

      const itemUpdate = {
        schoolId,
        academicPeriodId,
        assessmentPlanId: assessmentPlan._id,
        classGroupId,
        gradeId,
        subjectId,
        subjectOfferingId: subjectRow.subjectOfferingId ?? null,
        teacherId,
        title: spec.title,
        description: "Seeded demo data for EduSentrix marketing video capture.",
        assessmentType: spec.assessmentType,
        sourceType: "manual",
        sourceRefType: SOURCE_REF_TYPE,
        sourceRefId: studentId,
        maxScore: 100,
        assessedAt: now,
        componentKey: spec.component.key,
        contributesToReport: true,
        contributionLockedByRule: false,
        missingPolicy: "exclude_from_average",
        visibility: "visible_to_parent_after_release",
        status: "completed",
        updatedBy: studentId,
        createdBy: studentId,
      };

      const item = dryRun
        ? { _id: new mongoose.Types.ObjectId(), ...itemUpdate }
        : await AssessmentItem.findOneAndUpdate(
            filter,
            { $set: itemUpdate },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          ).lean();

      itemDocs.push(item);

      if (!dryRun) {
        await AssessmentScore.findOneAndUpdate(
          {
            schoolId,
            assessmentItemId: item._id,
            studentId,
          },
          {
            $set: {
              score: spec.score,
              maxScoreSnapshot: 100,
              percentage: spec.score,
              status: scoreStatus(spec.score),
              remarks: "Seeded for marketing demo.",
              gradedAt: now,
              recordedBy: studentId,
              updatedBy: studentId,
            },
            $setOnInsert: {
              schoolId,
              academicPeriodId,
              assessmentPlanId: assessmentPlan._id,
              classGroupId,
              subjectId,
              teacherId,
              assessmentItemId: item._id,
              studentId,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    const calculation = calculateSubjectResult({
      scoreComponents,
      componentRules: [
        ruleForComponent(classworkComponent.key, assessmentPlan.componentRules ?? []),
        ruleForComponent(examComponent.key, assessmentPlan.componentRules ?? []),
      ],
      items: itemDocs.map((item) => mapAssessmentItemToCalculationItem(serializeAssessmentItem(item))),
      scores: itemDocs.map((item, itemIndex) => ({
        assessmentItemId: String(item._id),
        score: itemSpecs[itemIndex]?.score ?? null,
        status: "recorded",
      })),
      gradeBoundaries: gradingPolicy.gradeBoundaries,
      passMark: gradingPolicy.passMark,
      roundingRule: gradingPolicy.roundingRule,
    });

    if (!dryRun) {
      await SubjectResult.findOneAndUpdate(
        {
          schoolId,
          academicPeriodId,
          classGroupId,
          subjectId,
          studentId,
        },
        {
          $set: {
            assessmentPlanId: assessmentPlan._id,
            gradingPolicyId: new mongoose.Types.ObjectId(gradingPolicy._id),
            gradeId,
            teacherId,
            components: calculation.components,
            finalScore: calculation.finalScore,
            roundedFinalScore: calculation.roundedFinalScore,
            gradeLabel: calculation.gradeLabel,
            gradePoint: calculation.gradePoint,
            descriptor: calculation.descriptor,
            isPassed: calculation.isPassed,
            subjectPosition: null,
            totalStudentsForSubject: null,
            subjectRemark: null,
            missingRequiredItems: calculation.missingRequiredItems,
            sourceAssessmentItemIds: calculation.sourceAssessmentItemIds.map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
            calculationSnapshot: {
              seededFor: "marketing_video",
              seededAt: now.toISOString(),
              target,
            },
            status: "approved",
            submittedBy: studentId,
            submittedAt: now,
            approvedBy: studentId,
            approvedAt: now,
            lockedAt: now,
            returnedBy: null,
            returnedAt: null,
            returnReason: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    updates.push({
      subjectId: String(subjectId),
      subjectName: subject.name,
      classwork: target.classwork,
      exam: target.exam,
      finalScore: calculation.roundedFinalScore,
      gradeLabel: calculation.gradeLabel,
      descriptor: calculation.descriptor,
      components: calculation.components,
    });
  }

  const finalScores = updates
    .map((entry) => Number(entry.finalScore))
    .filter((score) => Number.isFinite(score));
  const averageFinalScore =
    finalScores.length > 0
      ? Math.round((finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length) * 10) / 10
      : 0;

  if (!dryRun) {
    if (latestCard) {
      await StudentReportCard.updateOne(
        { _id: latestCard._id },
        {
          $set: {
            subjectResultsSnapshot: updates.map((entry) => {
              const grade = resolveGrade(Number(entry.finalScore), gradingPolicy.gradeBoundaries);
              return {
                subjectId: entry.subjectId,
                subjectName: entry.subjectName,
                finalScore: entry.finalScore,
                roundedFinalScore: entry.finalScore,
                gradeLabel: grade.label,
                gradePoint: grade.point,
                descriptor: grade.descriptor,
                isPassed: Number(entry.finalScore) >= gradingPolicy.passMark,
                subjectPosition: null,
                subjectRemark: null,
                components: entry.components as SubjectResultComponentSnapshot[],
                status: "approved",
              };
            }),
            "termSummarySnapshot.subjectCount": updates.length,
            "termSummarySnapshot.passedSubjectCount": updates.filter(
              (entry) => Number(entry.finalScore) >= gradingPolicy.passMark
            ).length,
            "termSummarySnapshot.averageFinalScore": averageFinalScore,
            "gradingPolicySnapshot._id": gradingPolicy._id,
            "gradingPolicySnapshot.name": gradingPolicy.name,
            "gradingPolicySnapshot.scoreComponents": gradingPolicy.scoreComponents,
            "gradingPolicySnapshot.gradeBoundaries": gradingPolicy.gradeBoundaries,
            "gradingPolicySnapshot.passMark": gradingPolicy.passMark,
            "gradingPolicySnapshot.roundingRule": gradingPolicy.roundingRule,
          },
        }
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        studentId: STUDENT_ID,
        period: `${academicPeriod.yearLabel} ${academicPeriod.term}`,
        assessmentPlan: assessmentPlan.name,
        gradingPolicy: gradingPolicy.name,
        components: {
          classwork: {
            key: classworkComponent.key,
            label: classworkComponent.label,
            weight: classworkComponent.weight,
          },
          exam: {
            key: examComponent.key,
            label: examComponent.label,
            weight: examComponent.weight,
          },
        },
        seededSubjects: updates,
        averageFinalScore,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
