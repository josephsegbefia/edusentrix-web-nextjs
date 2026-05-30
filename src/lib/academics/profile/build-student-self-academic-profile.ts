import mongoose from "mongoose";
import type { SchoolMemberContext } from "@/lib/auth/requireSchoolMember";
import { buildStudentAcademicProfileDTO } from "@/lib/academics/profile/buildStudentAcademicProfileDTO";
import { sanitizeProfileForLearnerView } from "@/lib/academics/profile/learner-academic-profile-utils";
import { Student } from "@/models/Student";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";

export { sanitizeProfileForLearnerView } from "@/lib/academics/profile/learner-academic-profile-utils";

type StudentLookupRow = {
  _id: mongoose.Types.ObjectId;
};

export async function resolveActiveStudentForSchoolMember(
  context: Pick<SchoolMemberContext, "userId" | "schoolId">
): Promise<StudentLookupRow> {
  const student = (await Student.findOne({
    userId: context.userId,
    schoolId: context.schoolId,
    status: "active",
  })
    .select("_id")
    .lean()) as StudentLookupRow | null;

  if (!student) {
    throw new Error("Student not found");
  }

  return student;
}

export async function buildStudentSelfAcademicProfile(input: {
  context: Pick<SchoolMemberContext, "userId" | "schoolId">;
  periodId?: string | null;
  allowProgressVisibility?: boolean;
}): Promise<StudentAcademicProfileDTO> {
  const student = await resolveActiveStudentForSchoolMember(input.context);

  const schoolId =
    input.context.schoolId instanceof mongoose.Types.ObjectId
      ? input.context.schoolId
      : new mongoose.Types.ObjectId(String(input.context.schoolId));

  const profile = await buildStudentAcademicProfileDTO({
    schoolId,
    studentId: student._id,
    academicPeriodId: input.periodId ?? null,
    visibilityMode: "student",
    allowProgressVisibility: input.allowProgressVisibility ?? false,
  });

  return sanitizeProfileForLearnerView(profile);
}
