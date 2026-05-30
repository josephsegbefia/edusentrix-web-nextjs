import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamInvigilatorServiceError,
  parseReplaceInvigilatorBody,
  replaceExamInvigilatorAssignment,
} from "@/lib/exams/exam-invigilator-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; assignmentId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, assignmentId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(assignmentId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const parsedBody = parseReplaceInvigilatorBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await replaceExamInvigilatorAssignment({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      assignmentId,
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamInvigilatorServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam invigilator replace POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to replace invigilator" },
      { status: 500 }
    );
  }
}
