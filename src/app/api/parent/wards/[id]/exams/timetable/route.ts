import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import {
  ExamPublishedViewServiceError,
  getPublishedExamTimetableForWard,
} from "@/lib/exams/exam-published-view-service";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const parentContext = await requireParent();
    await connectToDatabase();

    const { id: wardId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(wardId)) {
      return NextResponse.json({ success: false, error: "Invalid ward id" }, { status: 400 });
    }

    await verifyGuardianAccess(parentContext.userId, wardId, { mode: "api" });

    const periodId = req.nextUrl.searchParams.get("periodId");
    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json({ success: false, error: "Invalid periodId" }, { status: 400 });
    }

    const data = await getPublishedExamTimetableForWard({
      schoolId: parentContext.schoolId,
      wardId: new mongoose.Types.ObjectId(wardId),
      academicPeriodId: periodId ? new mongoose.Types.ObjectId(periodId) : null,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamPublishedViewServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Parent ward exam timetable GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load exam timetable" },
      { status: 500 }
    );
  }
}
