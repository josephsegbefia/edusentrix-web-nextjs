import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamTimetableEntryServiceError,
  deleteDraftExamTimetableEntry,
  getExamTimetableEntryById,
  parseUpdateExamTimetableEntryBody,
  updateExamTimetableEntry,
} from "@/lib/exams/exam-timetable-entry-service";

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
  ctx: { params: Promise<{ sessionId: string; entryId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, entryId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(entryId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const data = await getExamTimetableEntryById({
      schoolId: toObjectId(schoolId),
      sessionId,
      entryId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamTimetableEntryServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam timetable entry GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exam timetable entry" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; entryId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, entryId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(entryId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const parsedBody = parseUpdateExamTimetableEntryBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await updateExamTimetableEntry({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      entryId,
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamTimetableEntryServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam timetable entry PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update exam timetable entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string; entryId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId, entryId } = await ctx.params;
    if (!parseId(sessionId) || !parseId(entryId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const data = await deleteDraftExamTimetableEntry({
      schoolId: toObjectId(schoolId),
      sessionId,
      entryId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamTimetableEntryServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam timetable entry DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete exam timetable entry" },
      { status: 500 }
    );
  }
}
