import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import { Student } from "@/models/Student";

function pollFilter(schoolId: unknown, grades: unknown[], classes: unknown[]) {
  const now = new Date();
  return {
    schoolId,
    status: { $in: ["live", "closed"] },
    $and: [
      { $or: [{ "schedule.startDate": null }, { "schedule.startDate": { $exists: false } }, { "schedule.startDate": { $lte: now } }] },
      { $or: [{ "schedule.endDate": null }, { "schedule.endDate": { $exists: false } }, { "schedule.endDate": { $gte: now } }, { status: "closed" }] },
    ],
    $or: [
      { "audience.scope": { $in: ["school", "parents"] } },
      { "audience.scope": "grade", "audience.gradeIds": { $in: grades } },
      { "audience.scope": "class", "audience.classGroupIds": { $in: classes } },
    ],
  };
}

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    const students = await Student.find({ _id: { $in: wardIds }, schoolId: ctx.schoolId })
      .select("gradeId classGroupId")
      .lean();
    const polls = await CommunityPoll.find(
      pollFilter(
        ctx.schoolId,
        students.map((student) => student.gradeId).filter(Boolean),
        students.map((student) => student.classGroupId).filter(Boolean)
      )
    )
      .sort({ "schedule.endDate": 1, createdAt: -1 })
      .lean();
    const votes = await CommunityPollVote.find({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      pollId: { $in: polls.map((poll) => poll._id) },
    })
      .select("pollId")
      .lean();
    const voted = new Set(votes.map((vote) => String(vote.pollId)));
    return NextResponse.json({
      success: true,
      data: {
        polls: polls.map((poll) => ({
          id: String(poll._id),
          title: poll.title,
          description: poll.description || null,
          wardId: null,
          wardName: null,
          status: poll.status === "live" ? "active" : "closed",
          optionType: poll.questions?.[0]?.type === "comment" ? "text" : poll.questions?.[0]?.type === "yes_no" ? "yes_no" : "single_choice",
          deadline: poll.schedule?.endDate?.toISOString?.() || null,
          hasResponded: voted.has(String(poll._id)),
          createdAt: poll.createdAt?.toISOString?.() || new Date().toISOString(),
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load polls";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
