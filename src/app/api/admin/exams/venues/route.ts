import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamVenueServiceError,
  createExamVenue,
  listExamVenues,
  parseCreateExamVenueBody,
} from "@/lib/exams/exam-venue-service";

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
    const activeOnly = searchParams.get("activeOnly") === "true";

    const data = await listExamVenues({
      schoolId: toObjectId(schoolId),
      activeOnly,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Exam venues GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exam venues" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const parsedBody = parseCreateExamVenueBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await createExamVenue({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamVenueServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam venues POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create exam venue" },
      { status: 500 }
    );
  }
}
