import "server-only";

import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { resolveSubjectOfferingForSchool } from "@/lib/subject-offerings/resolve-subject-offering";

export async function resolveLessonNoteSubjectOffering(args: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectOfferingId?: mongoose.Types.ObjectId | string | null;
  subjectId?: mongoose.Types.ObjectId | string | null;
}) {
  if (args.subjectOfferingId) {
    const explicit = await resolveSubjectOfferingForSchool({
      schoolId: args.schoolId,
      subjectOfferingId: args.subjectOfferingId,
      classGroupId: args.classGroupId,
      requireClassAssignment: true,
    });
    if (!explicit.ok) {
      return explicit;
    }
    return { ok: true as const, subjectOfferingId: explicit.offering._id };
  }

  if (!args.subjectId || !mongoose.Types.ObjectId.isValid(String(args.subjectId))) {
    return {
      ok: false as const,
      status: 400,
      error: "Lesson note is missing a subject offering and subject",
    };
  }

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

  const subjectId = new mongoose.Types.ObjectId(String(args.subjectId));
  const classOfferingIds = classGroup.subjectOfferingIds ?? [];

  const offering = await SubjectOffering.findOne({
    schoolId: args.schoolId,
    subjectId,
    isActive: true,
    ...(classOfferingIds.length ? { _id: { $in: classOfferingIds } } : {}),
    ...(classGroup.gradeId ? { gradeIds: classGroup.gradeId } : {}),
  })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId } | null>();

  if (offering) {
    return { ok: true as const, subjectOfferingId: offering._id };
  }

  if (classOfferingIds.length > 0) {
    const fallback = await SubjectOffering.findOne({
      schoolId: args.schoolId,
      subjectId,
      isActive: true,
      gradeIds: classGroup.gradeId,
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();
    if (fallback) {
      return { ok: true as const, subjectOfferingId: fallback._id };
    }
  }

  const classHasSubjectOfferingForSubject = await SubjectOffering.exists({
    schoolId: args.schoolId,
    _id: { $in: classOfferingIds },
    subjectId,
    isActive: true,
  });
  const gradeHasSubjectOfferingForSubject = classGroup.gradeId
    ? await SubjectOffering.exists({
        schoolId: args.schoolId,
        subjectId,
        gradeIds: classGroup.gradeId,
        isActive: true,
      })
    : null;

  if (!classHasSubjectOfferingForSubject && gradeHasSubjectOfferingForSubject) {
    return {
      ok: false as const,
      status: 400,
      error: "This subject offering has not been assigned to the selected class group",
    };
  }

  const subjectOfferingIdsLabel = classOfferingIds.map(String).join(", ");
  return {
    ok: false as const,
    status: 400,
    error: subjectOfferingIdsLabel
      ? "Could not match this lesson note subject to any subject offering on the selected class group"
      : "The selected class group has no subject offerings assigned",
  };
}
