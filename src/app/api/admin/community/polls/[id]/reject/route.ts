// src/app/api/admin/community/polls/[id]/reject/route.ts
/**
 * Reject a poll - admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
import mongoose from "mongoose";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const RejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const body = await req.json();
    const parsed = RejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Can only reject pending polls
    if (poll.approvalStatus !== "pending") {
      return NextResponse.json(
        { error: `Cannot reject poll with approval status "${poll.approvalStatus}"` },
        { status: 400 }
      );
    }

    await CommunityPoll.updateOne(
      { _id: poll._id },
      {
        $set: {
          approvalStatus: "rejected",
          approvalNotes: parsed.data.reason,
          approvedBy: userIdObj,
          approvedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ message: "Poll rejected" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error rejecting poll:", error);
    return NextResponse.json({ error: "Failed to reject poll" }, { status: 500 });
  }
}
