// src/app/api/admin/community/polls/[id]/close/route.ts
/**
 * Close a poll - sets status to "closed".
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
    const { schoolId } = await requireSchoolAdmin();
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

    // Can only close a live poll
    if (poll.status !== "live") {
      return NextResponse.json(
        { error: `Cannot close poll with status "${poll.status}"` },
        { status: 400 }
      );
    }

    const now = new Date();

    await CommunityPoll.updateOne(
      { _id: poll._id },
      {
        $set: {
          status: "closed",
          "schedule.endDate": now,
        },
      }
    );

    return NextResponse.json({ message: "Poll closed successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error closing poll:", error);
    return NextResponse.json({ error: "Failed to close poll" }, { status: 500 });
  }
}
