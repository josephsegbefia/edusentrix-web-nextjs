import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamAssessmentLinkServiceError,
  listExamSessionMissingAssessmentLinks,
} from "@/lib/exams/exam-assessment-link-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json(
        { success: false, error: "Invalid exam session id" },
        { status: 400 }
      );
    }

    const data = await listExamSessionMissingAssessmentLinks({
      schoolId: toObjectId(schoolId),
      sessionId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamAssessmentLinkServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam missing assessment links GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list missing assessment links" },
      { status: 500 }
    );
  }
}
