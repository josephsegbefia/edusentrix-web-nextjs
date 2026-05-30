import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamInvigilatorServiceError,
  getExamInvigilatorAssignmentById,
  removeExamInvigilatorAssignment,
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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; assignmentId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, assignmentId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(assignmentId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const data = await getExamInvigilatorAssignmentById({
      schoolId: toObjectId(schoolId),
      sessionId,
      assignmentId,
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
    console.error("Exam invigilator GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invigilator assignment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; assignmentId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, assignmentId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(assignmentId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const data = await removeExamInvigilatorAssignment({
      schoolId: toObjectId(schoolId),
      sessionId,
      assignmentId,
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
    console.error("Exam invigilator DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove invigilator assignment" },
      { status: 500 }
    );
  }
}
