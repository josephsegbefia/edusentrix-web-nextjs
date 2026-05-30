import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import {
  ExamSchedulingLeoError,
  explainExamConflictWithLeo,
  requireExamSchedulingLeoContext,
} from "@/lib/leo/exam-scheduling-advisory-shared";

const bodySchema = z.object({
  conflictKey: z.string().trim().min(1),
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
      return NextResponse.json({ success: false, error: "conflictKey is required." }, { status: 400 });
    }

    const data = await explainExamConflictWithLeo({
      schoolId: auth.schoolId,
      actorId: auth.userId,
      sessionId,
      conflictKey: parsed.data.conflictKey,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamSchedulingLeoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Exam Leo explain-conflict POST:", error);
    return NextResponse.json({ success: false, error: "Failed to explain conflict" }, { status: 500 });
  }
}
