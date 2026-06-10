import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";

type TeacherSchemeContext = {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
};

type AssignmentScope = {
  academicPeriodId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  subjectOfferingId: mongoose.Types.ObjectId | null;
};

type PopulatedAssignment = {
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupId?:
    | {
        _id: mongoose.Types.ObjectId;
        gradeId?: mongoose.Types.ObjectId | null;
      }
    | mongoose.Types.ObjectId
    | null;
  subjectId?: mongoose.Types.ObjectId | null;
  subjectOfferingId?:
    | {
        _id: mongoose.Types.ObjectId;
        subjectId?: mongoose.Types.ObjectId | null;
      }
    | mongoose.Types.ObjectId
    | null;
};

function toObjectIdString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function populatedGradeId(value: PopulatedAssignment["classGroupId"]) {
  if (!value || typeof value !== "object" || !("gradeId" in value) || !value.gradeId) return null;
  return value.gradeId;
}

function populatedSubjectOfferingSubjectId(value: PopulatedAssignment["subjectOfferingId"]) {
  if (!value || typeof value !== "object" || !("subjectId" in value) || !value.subjectId) return null;
  return value.subjectId;
}

async function resolveCurrentPeriodId(schoolId: mongoose.Types.ObjectId) {
  const period = await AcademicPeriod.findOne({ schoolId, isCurrent: true }).select("_id").lean<{
    _id: mongoose.Types.ObjectId;
  } | null>();
  return period?._id ?? null;
}

export async function loadTeacherAssignmentScopes(
  ctx: TeacherSchemeContext,
  academicPeriodId?: mongoose.Types.ObjectId | null
): Promise<AssignmentScope[]> {
  const periodId = academicPeriodId ?? (await resolveCurrentPeriodId(ctx.schoolId));
  if (!periodId) return [];

  const assignments = await TeacherAssignment.find({
    schoolId: ctx.schoolId,
    teacherId: ctx.teacherId,
    academicPeriodId: periodId,
    status: "active",
  })
    .populate("classGroupId", "gradeId")
    .populate("subjectOfferingId", "subjectId")
    .select("academicPeriodId classGroupId subjectId subjectOfferingId")
    .lean<PopulatedAssignment[]>();

  const scopes: AssignmentScope[] = [];
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const classGroupId = toObjectIdString(assignment.classGroupId);
    const gradeId = populatedGradeId(assignment.classGroupId);
    const subjectId = assignment.subjectId ?? populatedSubjectOfferingSubjectId(assignment.subjectOfferingId);
    const subjectOfferingIdString = toObjectIdString(assignment.subjectOfferingId);

    if (!classGroupId || !gradeId || !subjectId) continue;

    const subjectOfferingId =
      subjectOfferingIdString && mongoose.Types.ObjectId.isValid(subjectOfferingIdString)
        ? new mongoose.Types.ObjectId(subjectOfferingIdString)
        : null;
    const key = [
      String(periodId),
      String(gradeId),
      classGroupId,
      String(subjectId),
      subjectOfferingId ? String(subjectOfferingId) : "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    scopes.push({
      academicPeriodId: periodId,
      gradeId,
      classGroupId: new mongoose.Types.ObjectId(classGroupId),
      subjectId,
      subjectOfferingId,
    });
  }

  return scopes;
}

function scopeToSchemeCondition(scope: AssignmentScope): Record<string, unknown> {
  const subjectConditions: Record<string, unknown>[] = [{ subjectId: scope.subjectId }];
  if (scope.subjectOfferingId) subjectConditions.push({ subjectOfferingId: scope.subjectOfferingId });

  return {
    academicPeriodId: scope.academicPeriodId,
    gradeId: scope.gradeId,
    $and: [
      { $or: subjectConditions },
      {
        $or: [
          { classGroupId: null },
          { classGroupId: { $exists: false } },
          { classGroupId: scope.classGroupId },
        ],
      },
    ],
  };
}

export async function teacherAssignedSchemeListFilter(
  ctx: TeacherSchemeContext
): Promise<Record<string, unknown> | null> {
  const scopes = await loadTeacherAssignmentScopes(ctx);
  if (scopes.length === 0) return null;
  return {
    schoolId: ctx.schoolId,
    status: { $in: ["approved", "active"] },
    $or: scopes.map(scopeToSchemeCondition),
  };
}

export async function teacherCanReadAssignedScheme(
  scheme: Pick<
    ISchemeOfWork,
    "schoolId" | "status" | "academicPeriodId" | "gradeId" | "classGroupId" | "subjectId" | "subjectOfferingId"
  >,
  ctx: TeacherSchemeContext
): Promise<boolean> {
  if (String(scheme.schoolId) !== String(ctx.schoolId)) return false;
  if (scheme.status !== "approved" && scheme.status !== "active") return false;
  if (!scheme.gradeId || !scheme.subjectId) return false;

  const scopes = await loadTeacherAssignmentScopes(ctx, scheme.academicPeriodId);
  return scopes.some((scope) => {
    const gradeMatches = String(scope.gradeId) === String(scheme.gradeId);
    const subjectMatches =
      String(scope.subjectId) === String(scheme.subjectId) ||
      Boolean(scope.subjectOfferingId && scheme.subjectOfferingId && String(scope.subjectOfferingId) === String(scheme.subjectOfferingId));
    const classMatches =
      !scheme.classGroupId || String(scope.classGroupId) === String(scheme.classGroupId);

    return gradeMatches && subjectMatches && classMatches;
  });
}
