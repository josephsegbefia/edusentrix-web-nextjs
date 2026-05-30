/**
 * @deprecated Use `buildStudentAcademicProfileDTO` from
 * `src/lib/academics/profile/buildStudentAcademicProfileDTO.ts`.
 *
 * Compatibility wrapper for routes and PDF generators that still expect
 * `StudentAcademicsDTO` (CA/exam-shaped). See Slice 21 deprecation doc.
 */

import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";
import type { StudentAcademicsDTO } from "@/types/admin/student-academics";

type LegacyParams = Parameters<typeof buildStudentAcademicsDTO>[0];

export async function buildLegacyStudentAcademicsDTO(
  params: LegacyParams
): Promise<StudentAcademicsDTO> {
  return buildStudentAcademicsDTO(params);
}

/** @deprecated Import `buildStudentAcademicsDTO` only inside this module. */
export { buildStudentAcademicsDTO };
