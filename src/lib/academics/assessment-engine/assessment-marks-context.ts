import mongoose from "mongoose";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { serializeGradingPolicy } from "@/lib/academics/assessment-engine/grading-policy-service";
import { serializeAssessmentPlan } from "@/lib/academics/assessment-engine/assessment-plan-service";
import {
  assertTeacherGradebookAccess,
  type TeacherGradebookAccessContext,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import type {
  AcademicGradingPolicyDTO,
  AssessmentPlanDTO,
} from "@/types/academics/assessment-engine";

export type TeacherMarksScope = {
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  classGroup: { _id: mongoose.Types.ObjectId; name: string; gradeId: mongoose.Types.ObjectId };
  subject: { _id: mongoose.Types.ObjectId; name: string };
  grade: { _id: mongoose.Types.ObjectId; name: string };
  academicPeriod: {
    _id: mongoose.Types.ObjectId;
    yearLabel: string;
    term: string;
    isCurrent: boolean;
  };
  assessmentPlan: AssessmentPlanDTO;
  gradingPolicy: AcademicGradingPolicyDTO;
};

function toObjectIdOrNull(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function resolveTeacherMarksScope(
  context: TeacherGradebookAccessContext,
  options: {
    classGroupId: string;
    subjectId: string;
    academicPeriodId?: string | null;
  }
): Promise<
  | { ok: true; scope: TeacherMarksScope }
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

  if (!classGroup || !subject || !classGroup.gradeId) {
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

  if (!period) {
    return { ok: false, error: "No active academic period", status: 400 };
  }

  const access = await assertTeacherGradebookAccess(context, {
    classGroupId: classGroupObjId,
    subjectId: subjectObjId,
    academicPeriodId: period._id as mongoose.Types.ObjectId,
  });

  if (!access.ok) {
    return { ok: false, error: access.error, status: access.status };
  }

  const assessmentPlanDoc = await AssessmentPlan.findOne({
    schoolId: context.schoolId,
    academicPeriodId: period._id,
    appliesToGradeId: classGroup.gradeId,
    appliesToClassGroupIds: classGroupObjId,
    status: "active",
  }).lean();

  if (!assessmentPlanDoc) {
    return {
      ok: false,
      error: "No active assessment plan applies to this class group and term.",
      status: 400,
    };
  }

  const gradingPolicyDoc = await AcademicGradingPolicy.findOne({
    _id: assessmentPlanDoc.gradingPolicyId,
    schoolId: context.schoolId,
  }).lean();

  if (!gradingPolicyDoc) {
    return {
      ok: false,
      error: "Linked grading policy was not found for this assessment plan.",
      status: 400,
    };
  }

  if (gradingPolicyDoc.status !== "active") {
    return {
      ok: false,
      error: "Assessment plan requires an active grading policy.",
      status: 400,
    };
  }

  const grade = await Grade.findById(classGroup.gradeId).select("_id name").lean();
  if (!grade) {
    return { ok: false, error: "Grade not found for class group", status: 404 };
  }

  return {
    ok: true,
    scope: {
      classGroupId: classGroupObjId,
      subjectId: subjectObjId,
      academicPeriodId: period._id as mongoose.Types.ObjectId,
      gradeId: grade._id as mongoose.Types.ObjectId,
      classGroup: {
        _id: classGroup._id as mongoose.Types.ObjectId,
        name: classGroup.name,
        gradeId: classGroup.gradeId as mongoose.Types.ObjectId,
      },
      subject: {
        _id: subject._id as mongoose.Types.ObjectId,
        name: subject.name,
      },
      grade: {
        _id: grade._id as mongoose.Types.ObjectId,
        name: grade.name,
      },
      academicPeriod: {
        _id: period._id as mongoose.Types.ObjectId,
        yearLabel: period.yearLabel,
        term: period.term,
        isCurrent: period.isCurrent,
      },
      assessmentPlan: serializeAssessmentPlan(assessmentPlanDoc),
      gradingPolicy: serializeGradingPolicy(gradingPolicyDoc),
    },
  };
}
