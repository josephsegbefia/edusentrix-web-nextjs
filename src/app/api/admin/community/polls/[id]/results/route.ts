// src/app/api/admin/community/polls/[id]/results/route.ts
/**
 * Get aggregated poll results.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void CommunityPoll.modelName;
    void CommunityPollVote.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const pollIdObj = new mongoose.Types.ObjectId(id);

    const poll = await CommunityPoll.findOne({
      _id: pollIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Get all votes for this poll
    const votes = await CommunityPollVote.find({ pollId: pollIdObj }).lean();

    // Build question results
    const questionResults = poll.questions.map((question: any) => {
      const questionId = String(question._id);
      
      // Find all answers for this question
      const questionAnswers = votes.flatMap((vote: any) =>
        (vote.answers || []).filter(
          (a: any) => String(a.questionId) === questionId
        )
      );

      const result: Record<string, unknown> = {
        questionId,
        prompt: question.prompt,
        type: question.type,
        totalResponses: questionAnswers.length,
      };

      // Aggregate based on question type
      switch (question.type) {
        case "single_choice":
        case "multi_choice": {
          const optionCounts: Record<string, { label: string; count: number }> = {};
          
          // Initialize all options with 0
          for (const opt of question.options || []) {
            optionCounts[String(opt._id)] = { label: opt.label, count: 0 };
          }

          // Count votes
          for (const answer of questionAnswers) {
            for (const optId of answer.optionIds || []) {
              const key = String(optId);
              if (optionCounts[key]) {
                optionCounts[key].count++;
              }
            }
          }

          // Track "other" responses
          const otherResponses = questionAnswers
            .filter((a: any) => a.otherText)
            .map((a: any) => a.otherText);

          result.options = Object.entries(optionCounts).map(([id, data]) => ({
            optionId: id,
            label: data.label,
            count: data.count,
            percentage: questionAnswers.length > 0
              ? Math.round((data.count / questionAnswers.length) * 100)
              : 0,
          }));
          result.otherResponses = otherResponses;
          break;
        }

        case "ranked_choice": {
          // For ranked choice, calculate average rank per option
          const rankSums: Record<string, { label: string; totalRank: number; count: number }> = {};
          
          for (const opt of question.options || []) {
            rankSums[String(opt._id)] = { label: opt.label, totalRank: 0, count: 0 };
          }

          for (const answer of questionAnswers) {
            const optionIds = answer.optionIds || [];
            optionIds.forEach((optId: any, index: number) => {
              const key = String(optId);
              if (rankSums[key]) {
                rankSums[key].totalRank += index + 1; // 1-indexed rank
                rankSums[key].count++;
              }
            });
          }

          result.options = Object.entries(rankSums)
            .map(([id, data]) => ({
              optionId: id,
              label: data.label,
              averageRank: data.count > 0
                ? Math.round((data.totalRank / data.count) * 10) / 10
                : null,
              responseCount: data.count,
            }))
            .sort((a, b) => (a.averageRank || 999) - (b.averageRank || 999));
          break;
        }

        case "likert": {
          // Aggregate numeric values (1-5 scale)
          const values = questionAnswers
            .map((a: any) => a.valueNumber)
            .filter((v: any) => typeof v === "number");
          
          const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          for (const v of values) {
            if (distribution[v] !== undefined) {
              distribution[v]++;
            }
          }

          const average = values.length > 0
            ? Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 10) / 10
            : null;

          result.distribution = distribution;
          result.average = average;
          break;
        }

        case "yes_no": {
          const yesCount = questionAnswers.filter((a: any) => a.valueBoolean === true).length;
          const noCount = questionAnswers.filter((a: any) => a.valueBoolean === false).length;

          result.yes = yesCount;
          result.no = noCount;
          result.yesPercentage = questionAnswers.length > 0
            ? Math.round((yesCount / questionAnswers.length) * 100)
            : 0;
          result.noPercentage = questionAnswers.length > 0
            ? Math.round((noCount / questionAnswers.length) * 100)
            : 0;
          break;
        }

        case "comment": {
          // Return text responses
          result.responses = questionAnswers
            .map((a: any) => a.text)
            .filter((t: any) => t);
          break;
        }
      }

      return result;
    });

    // Role breakdown
    const roleBreakdown: Record<string, number> = {};
    for (const vote of votes) {
      const role = (vote as any).role || "unknown";
      roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
    }

    return NextResponse.json({
      pollId: String(poll._id),
      title: poll.title,
      status: poll.status,
      totalVotes: votes.length,
      eligibleCount: poll.eligibleCount || 0,
      participationRate: poll.participationRate || 0,
      roleBreakdown,
      questions: questionResults,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching poll results:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
