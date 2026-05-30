import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import {
  buildStudentSelfAcademicProfile,
  resolveActiveStudentForSchoolMember,
} from "@/lib/academics/profile/build-student-self-academic-profile";
import { buildSubjectAcademicProfileBreakdown } from "@/lib/academics/profile/buildSubjectAcademicProfileBreakdown";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Subject } from "@/models/Subject";

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

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
        { success: false, error: "Invalid subject or period id" },
        { status: 400 }
      );
    }

    const student = await resolveActiveStudentForSchoolMember(context);
    const schoolObjectId =
      context.schoolId instanceof mongoose.Types.ObjectId
        ? context.schoolId
        : new mongoose.Types.ObjectId(String(context.schoolId));

    const [period, subject] = await Promise.all([
      AcademicPeriod.findOne({ _id: periodId, schoolId: schoolObjectId }).select("_id").lean(),
      Subject.findOne({ _id: subjectId, schoolId: schoolObjectId }).select("_id").lean(),
    ]);

    if (!period) {
      return Response.json({ success: false, error: "Academic period not found" }, { status: 404 });
    }
    if (!subject) {
      return Response.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    await buildStudentSelfAcademicProfile({
      context,
      periodId,
    });

    const breakdown = await buildSubjectAcademicProfileBreakdown({
      schoolId: schoolObjectId,
      studentId: student._id,
      academicPeriodId: periodId,
      subjectId,
      visibilityMode: "student",
    });

    if (!breakdown) {
      return Response.json(
        {
          success: false,
          error: "No breakdown available. Details appear when your report card is published.",
        },
        { status: 404 }
      );
    }

    if (!breakdown.isOfficial && breakdown.dataSource !== "report_snapshot") {
      return Response.json(
        {
          success: false,
          error: "Detailed breakdown is available after your official report card is published.",
        },
        { status: 403 }
      );
    }

    return Response.json({ success: true, data: breakdown });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch student academic profile breakdown", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch academic breakdown";

    if (message === "Student not found") {
      return Response.json({ success: false, error: message }, { status: 404 });
    }

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
