import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamInvigilatorServiceError,
  acknowledgeExamInvigilatorAssignment,
} from "@/lib/exams/exam-invigilator-service";

function parseAssignmentId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { schoolId, teacherId } = await requireTeacher();
    await connectToDatabase();

    const { assignmentId } = await ctx.params;
    if (!parseAssignmentId(assignmentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid assignment id" },
        { status: 400 }
      );
    }

    const data = await acknowledgeExamInvigilatorAssignment({
      schoolId,
      teacherId,
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
    console.error("Teacher invigilator acknowledge POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge invigilation duty" },
      { status: 500 }
    );
  }
}
