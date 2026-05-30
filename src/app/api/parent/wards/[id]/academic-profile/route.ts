import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { buildParentWardAcademicProfile } from "@/lib/academics/profile/build-parent-ward-academic-profile";
import { Student } from "@/models/Student";

/**
 * Parent ward academic profile (released-first, no staff readiness leaks).
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §19.2, Slice 19
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: wardId } = await context.params;

  try {
    const parentContext = await requireParent();
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(wardId)) {
      return Response.json({ success: false, error: "Invalid ward id" }, { status: 400 });
    }

    const student = await Student.findOne({
      _id: wardId,
      schoolId: parentContext.schoolId,
    })
      .select("_id")
      .lean();

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const periodId =
      url.searchParams.get("periodId") ?? url.searchParams.get("termId");

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return Response.json({ success: false, error: "Invalid periodId" }, { status: 400 });
    }

    const profile = await buildParentWardAcademicProfile({
      context: parentContext,
      wardId,
      periodId,
      allowProgressVisibility: false,
    });

    return Response.json({ success: true, data: profile });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch parent ward academic profile", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch academic profile";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
