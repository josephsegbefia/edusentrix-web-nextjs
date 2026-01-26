// src/app/api/admin/community/polls/[id]/publish/route.ts
/**
 * Publish a poll - sets status to "live".
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Can only publish from draft or approved status
    if (!["draft", "approved"].includes(poll.status)) {
      return NextResponse.json(
        { error: `Cannot publish poll with status "${poll.status}"` },
        { status: 400 }
      );
    }

    // Check if approval is required but not granted
    if (poll.approvalStatus === "pending") {
      return NextResponse.json(
        { error: "Poll requires approval before publishing" },
        { status: 400 }
      );
    }

    if (poll.approvalStatus === "rejected") {
      return NextResponse.json(
        { error: "Poll was rejected and cannot be published" },
        { status: 400 }
      );
    }

    // Validate poll has at least one question
    if (!poll.questions || poll.questions.length === 0) {
      return NextResponse.json(
        { error: "Poll must have at least one question" },
        { status: 400 }
      );
    }

    // Set start date if not set
    const now = new Date();
    const updates: Record<string, unknown> = {
      status: "live",
    };

    if (!poll.schedule?.startDate) {
      updates["schedule.startDate"] = now;
    }

    await CommunityPoll.updateOne({ _id: poll._id }, { $set: updates });

    return NextResponse.json({ message: "Poll published successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error publishing poll:", error);
    return NextResponse.json({ error: "Failed to publish poll" }, { status: 500 });
  }
}
