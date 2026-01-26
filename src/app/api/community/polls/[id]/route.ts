// src/app/api/community/polls/[id]/route.ts
/**
 * Public/member API to get poll details for voting.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import mongoose from "mongoose";
import crypto from "crypto";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const memberContext = await requireSchoolMember({
      allowedRoles: ["parent", "student", "teacher", "staff"],
    });

    await connectToDatabase();

    void CommunityPoll.modelName;
    void CommunityPollVote.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(memberContext.schoolId));
    const pollIdObj = new mongoose.Types.ObjectId(id);

    const poll = await CommunityPoll.findOne({
      _id: pollIdObj,
      schoolId: schoolIdObj,
      status: "live",
    }).lean();

    if (!poll) {
      return NextResponse.json({ error: "Poll not found or not available" }, { status: 404 });
    }

    // Check if user has already voted
    const voterHash = crypto
      .createHash("sha256")
      .update(String(memberContext.userId))
      .digest("hex");

    const existingVote = await CommunityPollVote.findOne({
      pollId: pollIdObj,
      voterHash,
    }).lean();

    const p = poll as any;

    return NextResponse.json({
      id: String(p._id),
      title: p.title,
      description: p.description || null,
      coverImageUrl: p.coverImageUrl || null,
      allowAnonymous: p.allowAnonymous,
      allowComments: p.allowComments,
      revealResults: p.revealResults,
      schedule: {
        startDate: p.schedule?.startDate ? new Date(p.schedule.startDate).toISOString() : null,
        endDate: p.schedule?.endDate ? new Date(p.schedule.endDate).toISOString() : null,
      },
      questions: p.questions?.map((q: any) => ({
        id: String(q._id),
        prompt: q.prompt,
        type: q.type,
        required: q.required ?? true,
        allowOther: q.allowOther ?? false,
        order: q.order ?? 0,
        options: q.options?.map((opt: any) => ({
          id: String(opt._id),
          label: opt.label,
          imageUrl: opt.imageUrl || null,
          order: opt.order ?? 0,
        })) || [],
      })) || [],
      hasVoted: !!existingVote,
      totalVotes: p.totalVotes || 0,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching poll for voting:", error);
    return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 });
  }
}
