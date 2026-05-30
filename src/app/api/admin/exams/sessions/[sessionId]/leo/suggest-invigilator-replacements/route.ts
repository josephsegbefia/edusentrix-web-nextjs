import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import {
  ExamSchedulingLeoError,
  requireExamSchedulingLeoContext,
  suggestExamInvigilatorReplacementsWithLeo,
} from "@/lib/leo/exam-scheduling-advisory-shared";

const bodySchema = z.object({
  assignmentId: z.string().trim().min(1),
});

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await requireExamSchedulingLeoContext();
    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json({ success: false, error: "Invalid exam session id" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "assignmentId is required." }, { status: 400 });
    }

    const data = await suggestExamInvigilatorReplacementsWithLeo({
      schoolId: auth.schoolId,
      sessionId,
      assignmentId: parsed.data.assignmentId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamSchedulingLeoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Exam Leo suggest-invigilator-replacements POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to suggest invigilator replacements" },
      { status: 500 }
    );
  }
}
