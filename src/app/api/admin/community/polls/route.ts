// src/app/api/admin/community/polls/route.ts
/**
 * Admin API for community polls - list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll, ICommunityPoll, PollStatus } from "@/models/CommunityPoll";
import { User } from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";

// ============================================================================
// Validation Schemas
// ============================================================================

const PollOptionSchema = z.object({
  label: z.string().min(1).max(200),
  imageUrl: z.string().url().optional().nullable(),
  order: z.number().min(0).default(0),
});

const PollQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  type: z.enum(["single_choice", "multi_choice", "ranked_choice", "likert", "yes_no", "comment"]),
  options: z.array(PollOptionSchema).optional(),
  required: z.boolean().default(true),
  allowOther: z.boolean().default(false),
  order: z.number().min(0).default(0),
});

const CreatePollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  schedule: z.object({
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    timezone: z.string().default("UTC"),
  }).optional(),
  audience: z.object({
    scope: z.enum(["school", "grade", "class", "staff", "parents", "students"]),
    gradeIds: z.array(z.string()).optional(),
    classGroupIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
  }),
  questions: z.array(PollQuestionSchema).min(1).max(50),
  allowAnonymous: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  revealResults: z.enum(["live", "after_close", "admin_only"]).default("after_close"),
}).refine((data) => {
  // Validate question options based on type
  for (const q of data.questions) {
    if (["single_choice", "multi_choice", "ranked_choice"].includes(q.type)) {
      if (!q.options || q.options.length < 2) {
        return false;
      }
      if (q.type === "ranked_choice" && q.options.length < 3) {
        return false;
      }
    }
  }
  return true;
}, {
  message: "Choice questions require at least 2 options (3 for ranked choice)",
});

// ============================================================================
// GET - List polls
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void CommunityPoll.modelName;
    void User.modelName;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);

    // Query params
    const status = url.searchParams.get("status") as PollStatus | null;
    const scope = url.searchParams.get("scope");
    const createdBy = url.searchParams.get("createdBy");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const skip = Number(url.searchParams.get("skip")) || 0;

    // Build query
    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    if (status) query.status = status;
    if (scope) query["audience.scope"] = scope;
    if (createdBy) query.createdBy = new mongoose.Types.ObjectId(createdBy);

    // Fetch polls
    const [polls, total] = await Promise.all([
      CommunityPoll.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "firstName lastName email")
        .populate("approvedBy", "firstName lastName")
        .lean(),
      CommunityPoll.countDocuments(query),
    ]);

    // Transform response
    const data = polls.map((poll: any) => ({
      id: String(poll._id),
      title: poll.title,
      description: poll.description || null,
      status: poll.status,
      approvalStatus: poll.approvalStatus,
      audience: poll.audience,
      schedule: poll.schedule,
      questionCount: poll.questions?.length || 0,
      totalVotes: poll.totalVotes || 0,
      participationRate: poll.participationRate || 0,
      revealResults: poll.revealResults,
      allowAnonymous: poll.allowAnonymous,
      allowComments: poll.allowComments,
      coverImageUrl: poll.coverImageUrl || null,
      tags: poll.tags || [],
      createdBy: poll.createdBy
        ? {
            id: String(poll.createdBy._id),
            name: `${poll.createdBy.firstName} ${poll.createdBy.lastName}`.trim(),
            email: poll.createdBy.email,
          }
        : null,
      createdByRole: poll.createdByRole,
      approvedBy: poll.approvedBy
        ? {
            id: String(poll.approvedBy._id),
            name: `${poll.approvedBy.firstName} ${poll.approvedBy.lastName}`.trim(),
          }
        : null,
      approvedAt: poll.approvedAt ? new Date(poll.approvedAt).toISOString() : null,
      createdAt: new Date(poll.createdAt).toISOString(),
      updatedAt: new Date(poll.updatedAt).toISOString(),
    }));

    return NextResponse.json({
      data,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + polls.length < total,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching polls:", error);
    return NextResponse.json(
      { error: "Failed to fetch polls" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create poll
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = await req.json();
    const parsed = CreatePollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      coverImageUrl,
      tags,
      schedule,
      audience,
      questions,
      allowAnonymous,
      allowComments,
      revealResults,
    } = parsed.data;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    // Transform questions with ObjectIds
    const questionsWithIds = questions.map((q, qIndex) => ({
      _id: new mongoose.Types.ObjectId(),
      prompt: q.prompt,
      type: q.type,
      required: q.required,
      allowOther: q.allowOther,
      order: q.order ?? qIndex,
      options: q.options?.map((opt, oIndex) => ({
        _id: new mongoose.Types.ObjectId(),
        label: opt.label,
        imageUrl: opt.imageUrl || null,
        order: opt.order ?? oIndex,
      })),
    }));

    // Transform audience with ObjectIds
    const audienceTransformed = {
      scope: audience.scope,
      gradeIds: audience.gradeIds?.map((id) => new mongoose.Types.ObjectId(id)),
      classGroupIds: audience.classGroupIds?.map((id) => new mongoose.Types.ObjectId(id)),
      roles: audience.roles,
    };

    // Transform schedule
    const scheduleTransformed = {
      startDate: schedule?.startDate ? new Date(schedule.startDate) : null,
      endDate: schedule?.endDate ? new Date(schedule.endDate) : null,
      timezone: schedule?.timezone || "UTC",
    };

    // School-wide polls by admins don't need approval
    const isSchoolWide = audience.scope === "school";

    const poll = await CommunityPoll.create({
      schoolId: schoolIdObj,
      title,
      description,
      coverImageUrl: coverImageUrl || null,
      tags: tags || [],
      status: "draft",
      approvalStatus: isSchoolWide ? "not_required" : "not_required",
      createdBy: userIdObj,
      createdByRole: "school_admin",
      schedule: scheduleTransformed,
      audience: audienceTransformed,
      questions: questionsWithIds,
      allowAnonymous,
      allowComments,
      revealResults,
    });

    return NextResponse.json({
      id: String(poll._id),
      message: "Poll created successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating poll:", error);
    return NextResponse.json(
      { error: "Failed to create poll" },
      { status: 500 }
    );
  }
}
