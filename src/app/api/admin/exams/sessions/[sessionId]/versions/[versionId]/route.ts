import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamPublishServiceError,
  getExamTimetableVersionById,
} from "@/lib/exams/exam-publish-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; versionId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, versionId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(versionId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const data = await getExamTimetableVersionById({
      schoolId: toObjectId(schoolId),
      sessionId,
      versionId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamPublishServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam timetable version GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exam timetable version" },
      { status: 500 }
    );
  }
}
