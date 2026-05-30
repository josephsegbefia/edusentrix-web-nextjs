import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { buildParentWardAcademicProfile } from "@/lib/academics/profile/build-parent-ward-academic-profile";
import { buildSubjectAcademicProfileBreakdown } from "@/lib/academics/profile/buildSubjectAcademicProfileBreakdown";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";

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
      !mongoose.Types.ObjectId.isValid(wardId) ||
      !mongoose.Types.ObjectId.isValid(subjectId) ||
      !mongoose.Types.ObjectId.isValid(periodId)
    ) {
      return Response.json(
        { success: false, error: "Invalid ward, subject, or period id" },
        { status: 400 }
      );
    }

    const schoolObjectId =
      parentContext.schoolId instanceof mongoose.Types.ObjectId
        ? parentContext.schoolId
        : new mongoose.Types.ObjectId(String(parentContext.schoolId));

    const [student, period, subject] = await Promise.all([
      Student.findOne({ _id: wardId, schoolId: schoolObjectId }).select("_id").lean(),
      AcademicPeriod.findOne({ _id: periodId, schoolId: schoolObjectId }).select("_id").lean(),
      Subject.findOne({ _id: subjectId, schoolId: schoolObjectId }).select("_id").lean(),
    ]);

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    if (!period) {
      return Response.json({ success: false, error: "Academic period not found" }, { status: 404 });
    }
    if (!subject) {
      return Response.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    await buildParentWardAcademicProfile({
      context: parentContext,
      wardId,
      periodId,
    });

    const breakdown = await buildSubjectAcademicProfileBreakdown({
      schoolId: schoolObjectId,
      studentId: wardId,
      academicPeriodId: periodId,
      subjectId,
      visibilityMode: "parent",
    });

    if (!breakdown) {
      return Response.json(
        {
          success: false,
          error: "No breakdown available. Report cards are shown when officially released.",
        },
        { status: 404 }
      );
    }

    if (!breakdown.isOfficial && breakdown.dataSource !== "report_snapshot") {
      return Response.json(
        {
          success: false,
          error: "Detailed breakdown is available after the report card is released.",
        },
        { status: 403 }
      );
    }

    return Response.json({ success: true, data: breakdown });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch parent ward academic breakdown", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch academic breakdown";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
