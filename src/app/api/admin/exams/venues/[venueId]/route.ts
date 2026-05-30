import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamVenueServiceError,
  deactivateExamVenue,
  getExamVenueById,
  parseUpdateExamVenueBody,
  updateExamVenue,
} from "@/lib/exams/exam-venue-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parseVenueId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ venueId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { venueId } = await ctx.params;
    if (!parseVenueId(venueId)) {
      return NextResponse.json({ success: false, error: "Invalid venue id" }, { status: 400 });
    }

    const data = await getExamVenueById({
      schoolId: toObjectId(schoolId),
      venueId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamVenueServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam venue GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exam venue" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ venueId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { venueId } = await ctx.params;
    if (!parseVenueId(venueId)) {
      return NextResponse.json({ success: false, error: "Invalid venue id" }, { status: 400 });
    }

    const parsedBody = parseUpdateExamVenueBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await updateExamVenue({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      venueId,
      body: parsedBody.data,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamVenueServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam venue PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update exam venue" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ venueId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { venueId } = await ctx.params;
    if (!parseVenueId(venueId)) {
      return NextResponse.json({ success: false, error: "Invalid venue id" }, { status: 400 });
    }

    const data = await deactivateExamVenue({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      venueId,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof ExamVenueServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Exam venue DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Failed to deactivate exam venue" },
      { status: 500 }
    );
  }
}
