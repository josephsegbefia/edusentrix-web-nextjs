import { Types } from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";

export type SlotTeacherResolution =
  | { ok: true; teacherId: Types.ObjectId; source: "explicit" | "assignment" }
  | {
      ok: false;
      code: "MISSING_TEACHER" | "TEACHER_NOT_ASSIGNED_TO_SUBJECT_CLASS";
      message: string;
    };

export async function resolveTeacherForTimetableSlot(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  explicitTeacherId?: Types.ObjectId | null;
}): Promise<SlotTeacherResolution> {
  const baseQuery = {
    schoolId: args.schoolId,
    academicPeriodId: args.academicPeriodId,
    classGroupId: args.classGroupId,
    subjectId: args.subjectId,
    ...(args.subjectOfferingId ? { subjectOfferingId: args.subjectOfferingId } : {}),
    status: "active",
  };

  if (args.explicitTeacherId) {
    const assigned = await TeacherAssignment.exists({
      ...baseQuery,
      teacherId: args.explicitTeacherId,
    });

    if (!assigned) {
      return {
        ok: false,
        code: "TEACHER_NOT_ASSIGNED_TO_SUBJECT_CLASS",
        message:
          "This teacher is not actively assigned to teach this subject for this class group.",
      };
    }

    return {
      ok: true,
      teacherId: args.explicitTeacherId,
      source: "explicit",
    };
  }

  const assignment = await TeacherAssignment.findOne(baseQuery)
    .sort({ assignedAt: 1, createdAt: 1, _id: 1 })
    .select("teacherId")
    .lean<{ teacherId?: Types.ObjectId } | null>();

  if (!assignment?.teacherId) {
    return {
      ok: false,
      code: "MISSING_TEACHER",
      message: "No active teacher assignment exists for this subject and class group.",
    };
  }

  return {
    ok: true,
    teacherId: assignment.teacherId,
    source: "assignment",
  };
}

export function buildTeacherResolutionIssue(resolution: Exclude<SlotTeacherResolution, { ok: true }>) {
  return {
    code: resolution.code,
    field: "teacherId",
    message:
      resolution.code === "MISSING_TEACHER"
        ? "Assign a teacher to this subject and class group before scheduling it."
        : resolution.message,
    severity: "error" as const,
  };
}
