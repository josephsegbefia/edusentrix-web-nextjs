import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamAssessmentLinkServiceError,
  listLinkableAssessmentItemsForExamEntry,
} from "@/lib/exams/exam-assessment-link-service";

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
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; entryId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, entryId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(entryId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const classGroupId = req.nextUrl.searchParams.get("classGroupId");
    if (!classGroupId || !parseId(classGroupId)) {
      return NextResponse.json(
        { success: false, error: "classGroupId is required" },
        { status: 400 }
      );
    }

    const data = await listLinkableAssessmentItemsForExamEntry({
      schoolId: toObjectId(schoolId),
      sessionId,
      entryId,
      classGroupId,
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
    console.error("Exam assessment link candidates GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list linkable assessment items" },
      { status: 500 }
    );
  }
}
