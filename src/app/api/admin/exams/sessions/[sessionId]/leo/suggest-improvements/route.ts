import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  ExamSchedulingLeoError,
  requireExamSchedulingLeoContext,
  suggestExamScheduleImprovementsWithLeo,
} from "@/lib/leo/exam-scheduling-advisory-shared";

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await requireExamSchedulingLeoContext();
    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json({ success: false, error: "Invalid exam session id" }, { status: 400 });
    }

    const data = await suggestExamScheduleImprovementsWithLeo({
      schoolId: auth.schoolId,
      actorId: auth.userId,
      sessionId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamSchedulingLeoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Exam Leo suggest-improvements POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to suggest schedule improvements" },
      { status: 500 }
    );
  }
}
