// src/app/api/admin/community/polls/[id]/export/route.ts
/**
 * Export poll results as CSV.
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll, ICommunityPoll, IPollQuestion } from "@/models/CommunityPoll";
import { CommunityPollVote, ICommunityPollVote, IPollVoteAnswer } from "@/models/CommunityPollVote";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function escapeCsv(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").substring(0, 19);
}

function formatAnswerForExport(
  answer: IPollVoteAnswer | undefined,
  question: IPollQuestion
): string {
  if (!answer) return "";

  switch (question.type) {
    case "single_choice":
    case "multi_choice":
    case "ranked_choice": {
      const selectedLabels = answer.optionIds
        ?.map((optId: Types.ObjectId) => {
          const opt = question.options?.find(
            (o) => String(o._id) === String(optId)
          );
          return opt?.label || "";
        })
        .filter(Boolean);
      const result = selectedLabels?.join("; ") || "";
      if (answer.otherText) {
        return result ? `${result}; Other: ${answer.otherText}` : `Other: ${answer.otherText}`;
      }
      return result;
    }
    case "likert":
      return answer.valueNumber?.toString() || "";
    case "yes_no":
      return answer.valueBoolean === true ? "Yes" : answer.valueBoolean === false ? "No" : "";
    case "comment":
      return answer.text || "";
    default:
      return "";
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void CommunityPoll.modelName;
    void CommunityPollVote.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const pollIdObj = new mongoose.Types.ObjectId(id);

    // Fetch poll with questions
    const poll = await CommunityPoll.findOne({
      _id: pollIdObj,
      schoolId: schoolIdObj,
    }).lean<ICommunityPoll>();

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Fetch all votes
    const votes = await CommunityPollVote.find({
      pollId: pollIdObj,
      schoolId: schoolIdObj,
    })
      .sort({ submittedAt: -1 })
      .lean<ICommunityPollVote[]>();

    // Build CSV headers
    const headers = ["Vote ID", "Submitted At", "Voter Role"];
    for (const question of poll.questions) {
      headers.push(question.prompt);
    }

    // Build CSV rows
    const rows: string[][] = [];
    for (const vote of votes) {
      const row: string[] = [
        String(vote._id),
        formatDateTime(vote.submittedAt),
        vote.role || "unknown",
      ];

      // Add answers for each question
      for (const question of poll.questions) {
        const answer = vote.answers.find(
          (a: IPollVoteAnswer) => String(a.questionId) === String(question._id)
        );
        row.push(formatAnswerForExport(answer, question));
      }

      rows.push(row);
    }

    // Build CSV content
    const csvLines = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ];
    const csv = csvLines.join("\n");

    // Generate filename
    const pollTitle = poll.title.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);
    const fileName = `poll-results-${pollTitle}-${formatDate(new Date())}.csv`;

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "poll.exported",
      entityType: "community_poll",
      entityId: String(pollIdObj),
      description: `Exported poll results: ${poll.title}`,
      metadata: {
        pollId: String(pollIdObj),
        voteCount: votes.length,
        format: "csv",
      },
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error exporting poll results:", error);
    return NextResponse.json({ error: "Failed to export poll results" }, { status: 500 });
  }
}
