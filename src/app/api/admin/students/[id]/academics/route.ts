import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { buildLegacyStudentAcademicsDTO } from "@/lib/academics/buildLegacyStudentAcademicsDTO";
import {
  LEGACY_STUDENT_ACADEMICS_SUCCESSOR,
  legacyStudentAcademicsDeprecationHeaders,
} from "@/lib/academics/legacy-student-academics-deprecation";
import { Student } from "@/models/Student";

/**
 * Legacy StudentAcademicsDTO for admin tab charts/fallback.
 * @deprecated Prefer GET /api/admin/students/[id]/academic-profile
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await context.params;

  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    await connectToDatabase();

    if (!schoolId) {
      return Response.json({ success: false, error: "School ID not found" }, { status: 400 });
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return Response.json({ success: false, error: "Invalid studentId" }, { status: 400 });
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: schoolObjectId,
    })
      .select("_id")
      .lean();

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const termId =
      url.searchParams.get("termId") ?? url.searchParams.get("periodId");

    const academics = await buildLegacyStudentAcademicsDTO({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: termId,
    });

    const successor = LEGACY_STUDENT_ACADEMICS_SUCCESSOR.adminProfileApi(studentId);

    return Response.json(
      { success: true, data: academics },
      { headers: legacyStudentAcademicsDeprecationHeaders(successor) }
    );
  } catch (error) {
    console.error("Failed to fetch student academics", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch student academics";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
