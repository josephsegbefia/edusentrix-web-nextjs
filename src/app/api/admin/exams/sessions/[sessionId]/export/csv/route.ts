import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamExportServiceError,
  buildExamTimetableCsvExport,
  parseExamExportMode,
} from "@/lib/exams/exam-export-service";

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json({ success: false, error: "Invalid exam session id" }, { status: 400 });
    }

    const mode = parseExamExportMode(req.nextUrl.searchParams.get("mode"));
    const classGroupId = req.nextUrl.searchParams.get("classGroupId");
    const teacherId = req.nextUrl.searchParams.get("teacherId");
    const venueId = req.nextUrl.searchParams.get("venueId");

    const csv = await buildExamTimetableCsvExport({
      schoolId,
      sessionId,
      mode,
      classGroupId,
      teacherId,
      venueId,
    });

    return new NextResponse(csv.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csv.fileName}"`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamExportServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Exam CSV export GET:", error);
    return NextResponse.json({ success: false, error: "Failed to export exam timetable CSV" }, { status: 500 });
  }
}
