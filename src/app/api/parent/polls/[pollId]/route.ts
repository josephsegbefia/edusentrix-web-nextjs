import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";

type Params = Promise<{ pollId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const ctx = await requireParent();
    const { pollId } = await params;
    await connectToDatabase();
    const poll = await CommunityPoll.findOne({ _id: pollId, schoolId: ctx.schoolId }).lean();
    if (!poll) return NextResponse.json({ success: false, error: "Poll not found" }, { status: 404 });
    const vote = await CommunityPollVote.findOne({ pollId: poll._id, schoolId: ctx.schoolId, userId: ctx.userId }).lean();
    const question = poll.questions?.[0];
    return NextResponse.json({
      success: true,
      data: {
        id: String(poll._id),
        title: poll.title,
        description: poll.description || null,
        wardId: null,
        wardName: null,
        status: poll.status === "live" ? "active" : "closed",
        optionType: question?.type === "comment" ? "text" : question?.type === "yes_no" ? "yes_no" : "single_choice",
        deadline: poll.schedule?.endDate?.toISOString?.() || null,
        hasResponded: Boolean(vote),
        createdAt: poll.createdAt?.toISOString?.() || new Date().toISOString(),
        options: (question?.options ?? []).map((option) => ({ id: String(option._id), label: option.label })),
        selectedOptionIds: vote?.answers?.flatMap((answer) => (answer.optionIds ?? []).map(String)) ?? [],
        textResponse: vote?.answers?.find((answer) => answer.text)?.text ?? null,
        allowsEdit: false,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load poll";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
