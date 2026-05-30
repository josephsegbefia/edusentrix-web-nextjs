import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamAnalyticsServiceError,
  getExamSchedulingAnalytics,
} from "@/lib/exams/exam-analytics-service";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const academicPeriodId = req.nextUrl.searchParams.get("academicPeriodId");

    const data = await getExamSchedulingAnalytics({
      schoolId,
      academicPeriodId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamAnalyticsServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Exam analytics GET:", error);
    return NextResponse.json({ success: false, error: "Failed to load exam analytics" }, { status: 500 });
  }
}
