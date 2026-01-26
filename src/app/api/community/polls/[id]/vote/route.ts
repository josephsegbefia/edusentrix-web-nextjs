// src/app/api/community/polls/[id]/vote/route.ts
/**
 * Submit vote for a poll - V2 structure.
 * One vote document per poll per voter, storing all answers in an array.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember, canVote } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import mongoose from "mongoose";
import crypto from "crypto";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// Validation Schema - V2 Answers Array
// ============================================================================

const AnswerSchema = z.object({
  questionId: z.string(),
  optionIds: z.array(z.string()).optional(),
  valueNumber: z.number().min(1).max(5).optional(),
  valueBoolean: z.boolean().optional(),
  text: z.string().max(2000).optional(),
  otherText: z.string().max(500).optional(),
});

const VoteSchema = z.object({
  answers: z.array(AnswerSchema).min(1),
});

// ============================================================================
// Helper to hash IP for privacy
// ============================================================================

function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

// ============================================================================
// POST - Submit vote
// ============================================================================

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const memberContext = await requireSchoolMember({
      allowedRoles: ["parent", "student", "teacher", "staff"],
    });

    if (!canVote(memberContext)) {
      return NextResponse.json({ error: "You are not eligible to vote" }, { status: 403 });
    }

    await connectToDatabase();

    void CommunityPoll.modelName;
    void CommunityPollVote.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(memberContext.schoolId));
    const pollIdObj = new mongoose.Types.ObjectId(id);

    // Get poll
    const poll = await CommunityPoll.findOne({
      _id: pollIdObj,
      schoolId: schoolIdObj,
      status: "live",
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found or not accepting votes" }, { status: 404 });
    }

    // Check if poll is within schedule
    const now = new Date();
    if (poll.schedule?.startDate && new Date(poll.schedule.startDate) > now) {
      return NextResponse.json({ error: "Poll has not started yet" }, { status: 400 });
    }
    if (poll.schedule?.endDate && new Date(poll.schedule.endDate) < now) {
      return NextResponse.json({ error: "Poll has ended" }, { status: 400 });
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = VoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid vote data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { answers } = parsed.data;

    // Validate answers against poll questions
    const questionMap = new Map(
      poll.questions.map((q) => [String(q._id), q])
    );

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        return NextResponse.json(
          { error: `Invalid question ID: ${answer.questionId}` },
          { status: 400 }
        );
      }

      // Validate answer based on question type
      switch (question.type) {
        case "single_choice":
          if (!answer.optionIds || answer.optionIds.length !== 1) {
            return NextResponse.json(
              { error: `Single choice question requires exactly one option` },
              { status: 400 }
            );
          }
          break;
        case "multi_choice":
          if (!answer.optionIds || answer.optionIds.length === 0) {
            return NextResponse.json(
              { error: `Multi choice question requires at least one option` },
              { status: 400 }
            );
          }
          break;
        case "ranked_choice":
          if (!answer.optionIds || answer.optionIds.length === 0) {
            return NextResponse.json(
              { error: `Ranked choice question requires ordered options` },
              { status: 400 }
            );
          }
          break;
        case "likert":
          if (typeof answer.valueNumber !== "number" || answer.valueNumber < 1 || answer.valueNumber > 5) {
            return NextResponse.json(
              { error: `Likert question requires a value between 1 and 5` },
              { status: 400 }
            );
          }
          break;
        case "yes_no":
          if (typeof answer.valueBoolean !== "boolean") {
            return NextResponse.json(
              { error: `Yes/No question requires a boolean value` },
              { status: 400 }
            );
          }
          break;
        case "comment":
          if (!answer.text || answer.text.trim().length === 0) {
            return NextResponse.json(
              { error: `Comment question requires text` },
              { status: 400 }
            );
          }
          break;
      }

      // Validate option IDs exist
      if (answer.optionIds && question.options) {
        const validOptionIds = new Set(question.options.map((o) => String(o._id)));
        for (const optId of answer.optionIds) {
          if (!validOptionIds.has(optId) && optId !== "other") {
            return NextResponse.json(
              { error: `Invalid option ID: ${optId}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Check required questions
    for (const question of poll.questions) {
      if (question.required) {
        const answered = answers.some((a) => a.questionId === String(question._id));
        if (!answered) {
          return NextResponse.json(
            { error: `Required question not answered: ${question.prompt}` },
            { status: 400 }
          );
        }
      }
    }

    // Create voter hash
    const voterHash = crypto
      .createHash("sha256")
      .update(String(memberContext.userId))
      .digest("hex");

    // Get IP hash for anti-abuse
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip");
    const ipHash = hashIP(ip);

    // Determine role
    const role = memberContext.roles.includes("parent")
      ? "parent"
      : memberContext.roles.includes("student")
      ? "student"
      : memberContext.roles.includes("teacher")
      ? "teacher"
      : "staff";

    // Transform answers with ObjectIds
    const answersTransformed = answers.map((a) => ({
      questionId: new mongoose.Types.ObjectId(a.questionId),
      optionIds: a.optionIds?.map((id) => new mongoose.Types.ObjectId(id)),
      valueNumber: a.valueNumber,
      valueBoolean: a.valueBoolean,
      text: a.text,
      otherText: a.otherText,
    }));

    // Try to create vote (unique index will reject duplicates)
    try {
      await CommunityPollVote.create({
        pollId: pollIdObj,
        schoolId: schoolIdObj,
        answers: answersTransformed,
        userId: poll.allowAnonymous ? null : memberContext.userId,
        role,
        voterHash,
        ipHash,
        submittedAt: new Date(),
      });

      // Update vote count
      await CommunityPoll.updateOne(
        { _id: pollIdObj },
        { $inc: { totalVotes: 1 } }
      );

      return NextResponse.json({ message: "Vote submitted successfully" });
    } catch (err: any) {
      // Check for duplicate key error (already voted)
      if (err.code === 11000) {
        return NextResponse.json(
          { error: "You have already voted in this poll" },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error submitting vote:", error);
    return NextResponse.json({ error: "Failed to submit vote" }, { status: 500 });
  }
}
