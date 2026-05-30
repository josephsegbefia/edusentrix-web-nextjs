import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamDayOperationsServiceError,
  getTeacherExamDayOps,
} from "@/lib/exams/exam-day-operations-service";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ entryId: string }> }
) {
  try {
    const { schoolId, teacherId } = await requireTeacher();
    await connectToDatabase();

    const { entryId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      return NextResponse.json({ success: false, error: "Invalid entry id" }, { status: 400 });
    }

    const data = await getTeacherExamDayOps({ schoolId, teacherId, entryId });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamDayOperationsServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Teacher exam day ops GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load exam day operations" },
      { status: 500 }
    );
  }
}
