import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamReadinessServiceError,
  getExamSessionPublishReadiness,
} from "@/lib/exams/exam-readiness-service";

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
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json(
        { success: false, error: "Invalid exam session id" },
        { status: 400 }
      );
    }

    const data = await getExamSessionPublishReadiness({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamReadinessServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam publish readiness GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch publish readiness" },
      { status: 500 }
    );
  }
}
