import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { buildStudentAcademicProfileDTO } from "@/lib/academics/profile/buildStudentAcademicProfileDTO";
import { Student } from "@/models/Student";

/**
 * Student Academic Profile (read-only) for school admin / delegated staff.
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §19.1, Slice 7
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
      return Response.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return Response.json(
        { success: false, error: "Invalid studentId" },
        { status: 400 }
      );
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: schoolObjectId,
    })
      .select("_id")
      .lean();

    if (!student) {
      return Response.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const periodId =
      url.searchParams.get("periodId") ?? url.searchParams.get("termId");

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return Response.json(
        { success: false, error: "Invalid periodId" },
        { status: 400 }
      );
    }

    const profile = await buildStudentAcademicProfileDTO({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: periodId,
      visibilityMode: "admin",
      allowProgressVisibility: true,
    });

    return Response.json({ success: true, data: profile });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch student academic profile", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch student academic profile";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
