import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamSessionServiceError,
  createExamSession,
  listExamSessions,
  parseCreateExamSessionBody,
} from "@/lib/exams/exam-session-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const data = await listExamSessions({
      schoolId: toObjectId(schoolId),
      status: searchParams.get("status"),
      academicPeriodId: searchParams.get("academicPeriodId"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Exam sessions GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exam sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const parsedBody = parseCreateExamSessionBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await createExamSession({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamSessionServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam sessions POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create exam session" },
      { status: 500 }
    );
  }
}
