import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { buildStudentSelfAcademicProfile } from "@/lib/academics/profile/build-student-self-academic-profile";

/**
 * Student self academic profile (released-first, no staff readiness leaks).
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §19.3, Slice 20
 */
export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const url = new URL(req.url);
    const periodId =
      url.searchParams.get("periodId") ?? url.searchParams.get("termId");

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return Response.json({ success: false, error: "Invalid periodId" }, { status: 400 });
    }

    const profile = await buildStudentSelfAcademicProfile({
      context,
      periodId,
      allowProgressVisibility: false,
    });

    return Response.json({ success: true, data: profile });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch student academic profile", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch academic profile";

    if (message === "Student not found") {
      return Response.json({ success: false, error: message }, { status: 404 });
    }

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
