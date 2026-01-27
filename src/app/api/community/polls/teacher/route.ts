// src/app/api/community/polls/teacher/route.ts
/**
 * Teacher API for community polls - list own polls and create new ones.
 * Teacher-created polls go to pending_approval status and require admin approval.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll, PollStatus } from "@/models/CommunityPoll";
import { PollTemplate } from "@/models/PollTemplate";
import { Teacher } from "@/models/Teacher";
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
  templateId: z.string().optional().nullable(),
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
    scope: z.enum(["class", "grade"]), // Teachers can only create for their classes or grades
    gradeIds: z.array(z.string()).optional(),
    classGroupIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(), // students, parents, or both
  }),
  questions: z.array(PollQuestionSchema).min(1).max(50),
  allowAnonymous: z.boolean().default(true),
  allowComments: z.boolean().default(false),
  revealResults: z.enum(["live", "after_close", "admin_only"]).default("after_close"),
  minResponseRate: z.number().min(0).max(100).default(60),
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
}).refine((data) => {
  // Teachers must specify at least one class or grade
  if (data.audience.scope === "class" && (!data.audience.classGroupIds || data.audience.classGroupIds.length === 0)) {
    return false;
  }
  if (data.audience.scope === "grade" && (!data.audience.gradeIds || data.audience.gradeIds.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Teachers must specify at least one class or grade for their polls",
});

// ============================================================================
// GET - List teacher's own polls
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["teacher"] });
    await connectToDatabase();

    void CommunityPoll.modelName;
    void User.modelName;

    const url = new URL(req.url);

    // Query params
    const status = url.searchParams.get("status") as PollStatus | null;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const skip = Number(url.searchParams.get("skip")) || 0;

    // Build query - only teacher's own polls
    const query: Record<string, unknown> = {
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      createdByRole: "teacher",
    };

    if (status) query.status = status;

    // Fetch polls
    const [polls, total] = await Promise.all([
      CommunityPoll.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
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
      approvalNotes: poll.approvalNotes || null,
      audience: poll.audience,
      schedule: poll.schedule,
      questionCount: poll.questions?.length || 0,
      totalVotes: poll.totalVotes || 0,
      participationRate: poll.participationRate || 0,
      minResponseRate: poll.minResponseRate || 60,
      revealResults: poll.revealResults,
      allowAnonymous: poll.allowAnonymous,
      allowComments: poll.allowComments,
      coverImageUrl: poll.coverImageUrl || null,
      tags: poll.tags || [],
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
    console.error("Error fetching teacher polls:", error);
    return NextResponse.json(
      { error: "Failed to fetch polls" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create poll (goes to pending_approval)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["teacher"] });
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
      templateId,
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
      minResponseRate,
    } = parsed.data;

    // Verify teacher has access to the specified classes
    const teacher = await Teacher.findOne({
      userId: ctx.userId,
      schoolId: ctx.schoolId,
      status: "active",
    }).lean();

    if (!teacher) {
      return NextResponse.json(
        { error: "Teacher profile not found" },
        { status: 403 }
      );
    }

    // TODO: Add validation that teacher teaches the specified classes
    // For now, we trust the teacher is creating polls for their classes

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
      roles: audience.roles || ["students"],
    };

    // Transform schedule
    const scheduleTransformed = {
      startDate: schedule?.startDate ? new Date(schedule.startDate) : null,
      endDate: schedule?.endDate ? new Date(schedule.endDate) : null,
      timezone: schedule?.timezone || "UTC",
    };

    // Handle templateId
    let templateIdObj = null;
    if (templateId && mongoose.Types.ObjectId.isValid(templateId)) {
      templateIdObj = new mongoose.Types.ObjectId(templateId);
      // Increment template usage count
      await PollTemplate.updateOne(
        { _id: templateIdObj },
        { $inc: { usageCount: 1 } }
      );
    }

    // Teacher polls always require approval
    const poll = await CommunityPoll.create({
      schoolId: ctx.schoolId,
      templateId: templateIdObj,
      title,
      description,
      coverImageUrl: coverImageUrl || null,
      tags: tags || [],
      status: "pending_approval",
      approvalStatus: "pending",
      createdBy: ctx.userId,
      createdByRole: "teacher",
      schedule: scheduleTransformed,
      audience: audienceTransformed,
      questions: questionsWithIds,
      allowAnonymous,
      allowComments,
      revealResults,
      minResponseRate: minResponseRate ?? 60,
    });

    return NextResponse.json({
      id: String(poll._id),
      message: "Poll created and submitted for approval",
      status: "pending_approval",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating teacher poll:", error);
    return NextResponse.json(
      { error: "Failed to create poll" },
      { status: 500 }
    );
  }
}
