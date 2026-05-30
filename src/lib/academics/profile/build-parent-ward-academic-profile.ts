import mongoose from "mongoose";
import { verifyGuardianAccess, type ParentContext } from "@/lib/auth/requireParent";
import { buildStudentAcademicProfileDTO } from "@/lib/academics/profile/buildStudentAcademicProfileDTO";
import { sanitizeProfileForLearnerView } from "@/lib/academics/profile/learner-academic-profile-utils";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";

export { sanitizeProfileForLearnerView as sanitizeProfileForParentView } from "@/lib/academics/profile/learner-academic-profile-utils";

export async function buildParentWardAcademicProfile(input: {
  context: ParentContext;
  wardId: string;
  periodId?: string | null;
  /** Defaults false — parents see released official data only unless enabled. */
  allowProgressVisibility?: boolean;
}): Promise<StudentAcademicProfileDTO> {
  if (!mongoose.Types.ObjectId.isValid(input.wardId)) {
    throw new Error("Invalid ward id");
  }

  await verifyGuardianAccess(input.context.userId, input.wardId);

  const schoolId =
    input.context.schoolId instanceof mongoose.Types.ObjectId
      ? input.context.schoolId
      : new mongoose.Types.ObjectId(String(input.context.schoolId));

  const profile = await buildStudentAcademicProfileDTO({
    schoolId,
    studentId: input.wardId,
    academicPeriodId: input.periodId ?? null,
    visibilityMode: "parent",
    allowProgressVisibility: input.allowProgressVisibility ?? false,
  });

  return sanitizeProfileForLearnerView(profile);
}
