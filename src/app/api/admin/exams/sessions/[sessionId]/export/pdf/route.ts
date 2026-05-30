import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EXAM_EXPORT_PDF_TYPES } from "@/constants/academics/exam-scheduling-engine";
import type { ExamExportPdfType } from "@/types/academics/exam-scheduling-engine";
import {
  ExamExportServiceError,
  buildExamTimetablePdfExport,
  parseExamExportMode,
} from "@/lib/exams/exam-export-service";

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

function parsePdfType(value: string | null): ExamExportPdfType {
  if (value && EXAM_EXPORT_PDF_TYPES.includes(value as ExamExportPdfType)) {
    return value as ExamExportPdfType;
  }
  return "full";
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
    const type = parsePdfType(req.nextUrl.searchParams.get("type"));

    const pdf = await buildExamTimetablePdfExport({
      schoolId,
      sessionId,
      mode,
      type,
      classGroupId: req.nextUrl.searchParams.get("classGroupId"),
      teacherId: req.nextUrl.searchParams.get("teacherId"),
      venueId: req.nextUrl.searchParams.get("venueId"),
    });

    return new NextResponse(pdf.bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamExportServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Exam PDF export GET:", error);
    return NextResponse.json({ success: false, error: "Failed to export exam timetable PDF" }, { status: 500 });
  }
}
