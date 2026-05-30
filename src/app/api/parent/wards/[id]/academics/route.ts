import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { buildWardLegacyAcademicsCompatDTO } from "@/lib/academics/compatibility/build-ward-legacy-academics-compat";
import {
  LEGACY_STUDENT_ACADEMICS_SUCCESSOR,
  legacyStudentAcademicsDeprecationHeaders,
} from "@/lib/academics/legacy-student-academics-deprecation";
import { Student } from "@/models/Student";

/**
 * Legacy-shaped ward academics for overview cards (profile-first compat).
 * @deprecated Prefer GET /api/parent/wards/[id]/academic-profile for the academics tab.
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
      url.searchParams.get("termId") ?? url.searchParams.get("periodId");

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return Response.json({ success: false, error: "Invalid periodId" }, { status: 400 });
    }

    const academics = await buildWardLegacyAcademicsCompatDTO({
      context: parentContext,
      wardId,
      periodId,
    });

    const successor = LEGACY_STUDENT_ACADEMICS_SUCCESSOR.parentWardProfileApi(wardId);

    return Response.json(
      { success: true, data: academics },
      { headers: legacyStudentAcademicsDeprecationHeaders(successor) }
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch ward academics:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch academics";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
