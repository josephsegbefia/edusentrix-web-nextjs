import { Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export type StudentHomeworkVisibilityInput = {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
};

/** Matches `/api/student/assignments` visibility — class homework the student can see. */
export function buildStudentVisibleHomeworkFilter(input: StudentHomeworkVisibilityInput) {
  const filter: Record<string, unknown> = {
    schoolId: input.schoolId,
    status: { $in: ["published", "closed"] },
    classGroupIds: { $in: [input.classGroupId] },
    $or: [
      { targetStudentIds: { $exists: false } },
      { targetStudentIds: null },
      { targetStudentIds: { $size: 0 } },
      { targetStudentIds: input.studentId },
    ],
  };

  if (input.academicPeriodId) {
    filter.academicPeriodId = input.academicPeriodId;
  }

  return filter;
}

export async function getCurrentAcademicPeriodId(schoolId: Types.ObjectId) {
  const period = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  return period?._id ?? null;
}

export async function buildStudentHomeworkVisibilityInput(
  schoolId: Types.ObjectId,
  studentId: Types.ObjectId,
  classGroupId: Types.ObjectId
): Promise<StudentHomeworkVisibilityInput> {
  const academicPeriodId = await getCurrentAcademicPeriodId(schoolId);
  return {
    schoolId,
    studentId,
    classGroupId,
    academicPeriodId,
  };
}
