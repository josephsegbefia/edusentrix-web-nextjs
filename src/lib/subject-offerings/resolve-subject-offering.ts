import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering, type ISubjectOffering } from "@/models/SubjectOffering";

export type ResolvedSubjectOffering = Pick<
  ISubjectOffering,
  | "_id"
  | "schoolId"
  | "subjectId"
  | "displayName"
  | "shortName"
  | "code"
  | "curriculumCode"
  | "gradeBand"
  | "lessonNoteTemplateVariant"
  | "gradeIds"
>;

export function toObjectIdOrNull(
  value: string | mongoose.Types.ObjectId | null | undefined
): mongoose.Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function idsEqual(a: unknown, b: unknown) {
  return String(a) === String(b);
}

export async function resolveSubjectOfferingForSchool(args: {
  schoolId: mongoose.Types.ObjectId;
  subjectOfferingId: string | mongoose.Types.ObjectId | null | undefined;
  gradeId?: mongoose.Types.ObjectId | null;
  classGroupId?: mongoose.Types.ObjectId | null;
  requireClassAssignment?: boolean;
}) {
  const offeringId = toObjectIdOrNull(args.subjectOfferingId);
  if (!offeringId) {
    return { ok: false as const, status: 400, error: "Invalid subjectOfferingId" };
  }

  const offering = await SubjectOffering.findOne({
    _id: offeringId,
    schoolId: args.schoolId,
    isActive: true,
  })
    .select(
      "_id schoolId subjectId displayName shortName code curriculumCode gradeBand lessonNoteTemplateVariant gradeIds"
    )
    .lean<ResolvedSubjectOffering | null>();

  if (!offering) {
    return { ok: false as const, status: 404, error: "Subject offering not found for this school" };
  }

  if (args.gradeId && !offering.gradeIds.some((id) => idsEqual(id, args.gradeId))) {
    return {
      ok: false as const,
      status: 400,
      error: "This subject offering is not scoped to the selected grade",
    };
  }

  if (args.classGroupId) {
    const classGroup = await ClassGroup.findOne({
      _id: args.classGroupId,
      schoolId: args.schoolId,
    })
      .select("_id gradeId subjectOfferingIds")
      .lean<{
        _id: mongoose.Types.ObjectId;
        gradeId?: mongoose.Types.ObjectId | null;
        subjectOfferingIds?: mongoose.Types.ObjectId[];
      } | null>();

    if (!classGroup) {
      return { ok: false as const, status: 404, error: "Class group not found for this school" };
    }

    if (classGroup.gradeId && !offering.gradeIds.some((id) => idsEqual(id, classGroup.gradeId))) {
      return {
        ok: false as const,
        status: 400,
        error: "This subject offering is not scoped to the class group's grade",
      };
    }

    const assigned = (classGroup.subjectOfferingIds || []).some((id) => idsEqual(id, offering._id));
    if (args.requireClassAssignment && !assigned) {
      return {
        ok: false as const,
        status: 400,
        error: "This subject offering has not been assigned to the selected class group",
      };
    }
  }

  return { ok: true as const, offering };
}

