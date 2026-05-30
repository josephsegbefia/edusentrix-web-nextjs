import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  ExamAssessmentLinkServiceError,
  createLinkedAssessmentItemsForExamEntry,
  getExamEntryAssessmentLinkStatus,
  linkExistingAssessmentItemToExamEntry,
  parseCreateLinkedAssessmentItemsBody,
  parseLinkExistingAssessmentItemBody,
  parseUnlinkAssessmentLinkBody,
  unlinkAssessmentItemFromExamEntry,
  validateExamEntryAssessmentLink,
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

    const validateOnly = req.nextUrl.searchParams.get("validate") === "1";
    const data = validateOnly
      ? await validateExamEntryAssessmentLink({
          schoolId: toObjectId(schoolId),
          sessionId,
          entryId,
        })
      : await getExamEntryAssessmentLinkStatus({
          schoolId: toObjectId(schoolId),
          sessionId,
          entryId,
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
    console.error("Exam assessment link GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exam assessment link status" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const parsedBody = parseCreateLinkedAssessmentItemsBody(await req.json().catch(() => ({})));
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await createLinkedAssessmentItemsForExamEntry({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      entryId,
      body: parsedBody.data,
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
    console.error("Exam assessment link POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create linked assessment items" },
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

    const parsedBody = parseLinkExistingAssessmentItemBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await linkExistingAssessmentItemToExamEntry({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      entryId,
      body: parsedBody.data,
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
    console.error("Exam assessment link PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to link assessment item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const parsedBody = parseUnlinkAssessmentLinkBody(await req.json().catch(() => ({})));
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const data = await unlinkAssessmentItemFromExamEntry({
      schoolId: toObjectId(schoolId),
      actorId: toObjectId(userId),
      sessionId,
      entryId,
      body: parsedBody.data,
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
    console.error("Exam assessment link DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Failed to unlink assessment item" },
      { status: 500 }
    );
  }
}
