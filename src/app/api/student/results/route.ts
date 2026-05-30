import {
  LEGACY_STUDENT_ACADEMICS_SUCCESSOR,
  legacyStudentAcademicsDeprecationHeaders,
  legacyStudentAcademicsDeprecationMessage,
} from "@/lib/academics/legacy-student-academics-deprecation";

/**
 * @deprecated Removed — use GET /api/student/academic-profile
 */
export async function GET() {
  return Response.json(
    {
      success: false,
      error: legacyStudentAcademicsDeprecationMessage("GET /api/student/results"),
      deprecated: true,
      successor: LEGACY_STUDENT_ACADEMICS_SUCCESSOR.studentProfileApi,
    },
    {
      status: 410,
      headers: legacyStudentAcademicsDeprecationHeaders(
        LEGACY_STUDENT_ACADEMICS_SUCCESSOR.studentProfileApi
      ),
    }
  );
}
