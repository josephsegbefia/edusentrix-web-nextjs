import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamInvigilatorServiceError,
  assignExamInvigilator,
  listExamInvigilatorAssignments,
  parseAssignInvigilatorBody,
} from "@/lib/exams/exam-invigilator-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parseSessionId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { sessionId } = await ctx.params;
    if (!parseSessionId(sessionId)) {
      return NextResponse.json(
        { success: false, error: "Invalid exam session id" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const data = await listExamInvigilatorAssignments({
      schoolId: toObjectId(schoolId),
      sessionId,
      examTimetableEntryId: searchParams.get("entryId"),
      teacherId: searchParams.get("teacherId"),
      status: searchParams.get("status"),
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
    console.error("Exam invigilators GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invigilator assignments" },
      { status: 500 }
    );
  }
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

    const parsedBody = parseAssignInvigilatorBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await assignExamInvigilator({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamInvigilatorServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam invigilators POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to assign invigilator" },
      { status: 500 }
    );
  }
}
