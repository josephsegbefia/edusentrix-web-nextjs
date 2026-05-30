import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { resolveActiveStudentForSchoolMember } from "@/lib/academics/profile/build-student-self-academic-profile";
import {
  ExamPublishedViewServiceError,
  getPublishedExamTimetableForStudent,
} from "@/lib/exams/exam-published-view-service";

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const student = await resolveActiveStudentForSchoolMember(context);

    const periodId = req.nextUrl.searchParams.get("periodId");
    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json({ success: false, error: "Invalid periodId" }, { status: 400 });
    }

    const data = await getPublishedExamTimetableForStudent({
      schoolId: context.schoolId,
      studentId: student._id,
      academicPeriodId: periodId ? new mongoose.Types.ObjectId(periodId) : null,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamPublishedViewServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Student exam timetable GET:", error);
    const message = error instanceof Error ? error.message : "Failed to load exam timetable";
    if (message === "Student not found") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
