import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamTimetableEntryServiceError,
  bulkCreateExamTimetableEntries,
  parseBulkCreateExamTimetableEntriesBody,
} from "@/lib/exams/exam-timetable-entry-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json(
        { success: false, error: "Invalid exam session id" },
        { status: 400 }
      );
    }

    const parsedBody = parseBulkCreateExamTimetableEntriesBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await bulkCreateExamTimetableEntries({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamTimetableEntryServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam timetable entries bulk POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to bulk create exam timetable entries" },
      { status: 500 }
    );
  }
}
