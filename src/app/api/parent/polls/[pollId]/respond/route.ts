import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";

type Params = Promise<{ pollId: string }>;

const BodySchema = z.object({
  optionIds: z.array(z.string()).optional(),
  textResponse: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireParent();
    const { pollId } = await params;
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    await connectToDatabase();
    const poll = await CommunityPoll.findOne({ _id: pollId, schoolId: ctx.schoolId, status: "live" }).lean();
    if (!poll) return NextResponse.json({ success: false, error: "Poll not found" }, { status: 404 });
    const existing = await CommunityPollVote.findOne({ pollId: poll._id, schoolId: ctx.schoolId, userId: ctx.userId }).select("_id").lean();
    if (existing) return NextResponse.json({ success: false, error: "You have already responded to this poll" }, { status: 409 });
    const question = poll.questions?.[0];
    const answers = question
      ? [
          {
            questionId: question._id,
            optionIds: (body.optionIds ?? [])
              .filter((id) => mongoose.Types.ObjectId.isValid(id))
              .map((id) => new mongoose.Types.ObjectId(id)),
            text: body.textResponse || undefined,
          },
        ]
      : [];
    await CommunityPollVote.create({
      pollId: poll._id,
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: "parent",
      voterHash: `parent:${String(ctx.userId)}`,
      answers,
      submittedAt: new Date(),
    });
    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to submit poll response";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
