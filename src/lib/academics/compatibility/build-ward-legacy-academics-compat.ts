import mongoose from "mongoose";
import type { ParentContext } from "@/lib/auth/requireParent";
import { buildParentWardAcademicProfile } from "@/lib/academics/profile/build-parent-ward-academic-profile";
import { mapStudentAcademicProfileToLegacyDTO } from "@/lib/academics/compatibility/academic-profile-to-legacy-dto";
import { buildLegacyStudentAcademicsDTO } from "@/lib/academics/buildLegacyStudentAcademicsDTO";
import type { StudentAcademicsDTO } from "@/types/admin/student-academics";

/**
 * Profile-first compat builder for parent ward overview (`StudentAcademicsDTO` shape).
 * Falls back to the legacy builder if the profile has no usable period data.
 */
export async function buildWardLegacyAcademicsCompatDTO(input: {
  context: ParentContext;
  wardId: string;
  periodId?: string | null;
}): Promise<StudentAcademicsDTO> {
  const profile = await buildParentWardAcademicProfile({
    context: input.context,
    wardId: input.wardId,
    periodId: input.periodId,
    allowProgressVisibility: false,
  });

  const hasPeriod =
    !!profile.selectedPeriod.academicPeriodId || profile.periods.length > 0;
  const hasReleasedOrScoredData =
    profile.reportStatus.isReleased ||
    profile.subjectResults.length > 0 ||
    profile.summary.finalAverage != null;

  if (hasPeriod && (hasReleasedOrScoredData || profile.dataSource !== "none")) {
    const mapped = mapStudentAcademicProfileToLegacyDTO(profile);
    mapped.comments = mapped.comments.filter((row) => row.isPublic);
    return mapped;
  }

  const schoolId =
    input.context.schoolId instanceof mongoose.Types.ObjectId
      ? input.context.schoolId
      : new mongoose.Types.ObjectId(String(input.context.schoolId));

  const legacy = await buildLegacyStudentAcademicsDTO({
    schoolId,
    studentId: input.wardId,
    academicPeriodId: input.periodId ?? null,
  });

  return {
    ...legacy,
    comments: (legacy.comments || []).filter((comment) => comment.isPublic),
    dataSourceNotes: [
      ...(legacy.dataSourceNotes ?? []),
      "Fallback: legacy builder (no released profile data for period).",
    ],
  };
}
