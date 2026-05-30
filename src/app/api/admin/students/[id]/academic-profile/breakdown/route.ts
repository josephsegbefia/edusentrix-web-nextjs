import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { buildSubjectAcademicProfileBreakdown } from "@/lib/academics/profile/buildSubjectAcademicProfileBreakdown";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";

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

    const url = new URL(req.url);
    const subjectId = url.searchParams.get("subjectId");
    const periodId =
      url.searchParams.get("periodId") ?? url.searchParams.get("termId");

    if (!subjectId || !periodId) {
      return Response.json(
        { success: false, error: "subjectId and periodId are required" },
        { status: 400 }
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(subjectId) ||
      !mongoose.Types.ObjectId.isValid(periodId)
    ) {
      return Response.json(
        { success: false, error: "Invalid subjectId or periodId" },
        { status: 400 }
      );
    }

    const [student, period, subject] = await Promise.all([
      Student.findOne({ _id: studentId, schoolId: schoolObjectId }).select("_id").lean(),
      AcademicPeriod.findOne({ _id: periodId, schoolId: schoolObjectId })
        .select("_id")
        .lean(),
      Subject.findOne({ _id: subjectId, schoolId: schoolObjectId }).select("_id").lean(),
    ]);

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    if (!period) {
      return Response.json(
        { success: false, error: "Academic period not found" },
        { status: 404 }
      );
    }

    if (!subject) {
      return Response.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    const breakdown = await buildSubjectAcademicProfileBreakdown({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: periodId,
      subjectId,
      visibilityMode: "admin",
    });

    if (!breakdown) {
      return Response.json(
        {
          success: false,
          error: "No assessment breakdown available for this subject and period.",
        },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: breakdown });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch student academic profile breakdown", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch student academic profile breakdown";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
