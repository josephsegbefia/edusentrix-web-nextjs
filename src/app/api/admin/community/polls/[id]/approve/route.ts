// src/app/api/admin/community/polls/[id]/approve/route.ts
/**
 * Approve a poll - admin only.
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
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Can only approve pending polls
    if (poll.approvalStatus !== "pending") {
      return NextResponse.json(
        { error: `Cannot approve poll with approval status "${poll.approvalStatus}"` },
        { status: 400 }
      );
    }

    await CommunityPoll.updateOne(
      { _id: poll._id },
      {
        $set: {
          status: "approved",
          approvalStatus: "approved",
          approvedBy: userIdObj,
          approvedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ message: "Poll approved successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error approving poll:", error);
    return NextResponse.json({ error: "Failed to approve poll" }, { status: 500 });
  }
}
