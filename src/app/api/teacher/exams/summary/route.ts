import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamTeacherServiceError,
  getTeacherExamSummary,
} from "@/lib/exams/exam-teacher-service";

export async function GET() {
  try {
    const { schoolId, teacherId } = await requireTeacher();
    await connectToDatabase();

    const data = await getTeacherExamSummary({ schoolId, teacherId });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamTeacherServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Teacher exam summary GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load exam summary" },
      { status: 500 }
    );
  }
}
