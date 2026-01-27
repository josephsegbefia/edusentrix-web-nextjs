// src/app/api/community/polls/teacher/[id]/route.ts
/**
 * Teacher API for individual poll - get, update, delete.
 * Teachers can only modify their own polls, and only in draft/pending_approval status.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
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

const UpdatePollSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  schedule: z.object({
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    timezone: z.string().default("UTC"),
  }).optional(),
  audience: z.object({
    scope: z.enum(["class", "grade"]),
    gradeIds: z.array(z.string()).optional(),
    classGroupIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
  }).optional(),
  questions: z.array(PollQuestionSchema).min(1).max(50).optional(),
  allowAnonymous: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  revealResults: z.enum(["live", "after_close", "admin_only"]).optional(),
  minResponseRate: z.number().min(0).max(100).optional(),
});

// ============================================================================
// GET - Get poll details
// ============================================================================

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const memberCtx = await requireSchoolMember({ allowedRoles: ["teacher"] });
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid poll ID" },
        { status: 400 }
      );
    }

    // Find poll - must be owned by this teacher
    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: memberCtx.schoolId,
      createdBy: memberCtx.userId,
      createdByRole: "teacher",
    })
      .populate("approvedBy", "firstName lastName")
      .lean();

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: String(poll._id),
      templateId: poll.templateId ? String(poll.templateId) : null,
      title: poll.title,
      description: poll.description || null,
      coverImageUrl: poll.coverImageUrl || null,
      tags: poll.tags || [],
      status: poll.status,
      approvalStatus: poll.approvalStatus,
      approvalNotes: poll.approvalNotes || null,
      schedule: poll.schedule,
      audience: poll.audience,
      questions: poll.questions.map((q: any) => ({
        id: String(q._id),
        prompt: q.prompt,
        type: q.type,
        options: q.options?.map((opt: any) => ({
          id: String(opt._id),
          label: opt.label,
          imageUrl: opt.imageUrl || null,
          order: opt.order,
        })),
        required: q.required,
        allowOther: q.allowOther,
        order: q.order,
      })),
      allowAnonymous: poll.allowAnonymous,
      allowComments: poll.allowComments,
      revealResults: poll.revealResults,
      minResponseRate: poll.minResponseRate || 60,
      totalVotes: poll.totalVotes || 0,
      eligibleCount: poll.eligibleCount || 0,
      participationRate: poll.participationRate || 0,
      approvedBy: poll.approvedBy
        ? {
            id: String((poll.approvedBy as any)._id),
            name: `${(poll.approvedBy as any).firstName} ${(poll.approvedBy as any).lastName}`.trim(),
          }
        : null,
      approvedAt: poll.approvedAt ? new Date(poll.approvedAt).toISOString() : null,
      createdAt: new Date(poll.createdAt).toISOString(),
      updatedAt: new Date(poll.updatedAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching teacher poll:", error);
    return NextResponse.json(
      { error: "Failed to fetch poll" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update poll (only draft/pending_approval/rejected)
// ============================================================================

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const memberCtx = await requireSchoolMember({ allowedRoles: ["teacher"] });
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid poll ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdatePollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Find poll - must be owned by this teacher
    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: memberCtx.schoolId,
      createdBy: memberCtx.userId,
      createdByRole: "teacher",
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }

    // Only allow updates in draft, pending_approval, or rejected status
    const editableStatuses = ["draft", "pending_approval", "rejected"];
    if (!editableStatuses.includes(poll.status)) {
      return NextResponse.json(
        { error: `Cannot edit poll in ${poll.status} status` },
        { status: 403 }
      );
    }

    const updates = parsed.data;

    // Apply updates
    if (updates.title !== undefined) poll.title = updates.title;
    if (updates.description !== undefined) poll.description = updates.description;
    if (updates.coverImageUrl !== undefined) poll.coverImageUrl = updates.coverImageUrl;
    if (updates.tags !== undefined) poll.tags = updates.tags;
    if (updates.allowAnonymous !== undefined) poll.allowAnonymous = updates.allowAnonymous;
    if (updates.allowComments !== undefined) poll.allowComments = updates.allowComments;
    if (updates.revealResults !== undefined) poll.revealResults = updates.revealResults;
    if (updates.minResponseRate !== undefined) poll.minResponseRate = updates.minResponseRate;

    // Update schedule
    if (updates.schedule) {
      poll.schedule = {
        startDate: updates.schedule.startDate ? new Date(updates.schedule.startDate) : null,
        endDate: updates.schedule.endDate ? new Date(updates.schedule.endDate) : null,
        timezone: updates.schedule.timezone || poll.schedule?.timezone || "UTC",
      };
    }

    // Update audience
    if (updates.audience) {
      poll.audience = {
        scope: updates.audience.scope || poll.audience.scope,
        gradeIds: updates.audience.gradeIds?.map((id) => new mongoose.Types.ObjectId(id)) || poll.audience.gradeIds,
        classGroupIds: updates.audience.classGroupIds?.map((id) => new mongoose.Types.ObjectId(id)) || poll.audience.classGroupIds,
        roles: updates.audience.roles || poll.audience.roles,
      };
    }

    // Update questions
    if (updates.questions) {
      poll.questions = updates.questions.map((q, qIndex) => ({
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
    }

    // If poll was rejected and is being edited, reset to pending_approval
    if (poll.approvalStatus === "rejected") {
      poll.status = "pending_approval";
      poll.approvalStatus = "pending";
      poll.approvalNotes = undefined;
    }

    await poll.save();

    return NextResponse.json({
      id: String(poll._id),
      message: "Poll updated successfully",
      status: poll.status,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating teacher poll:", error);
    return NextResponse.json(
      { error: "Failed to update poll" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete poll (only draft/pending_approval/rejected)
// ============================================================================

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const memberCtx = await requireSchoolMember({ allowedRoles: ["teacher"] });
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid poll ID" },
        { status: 400 }
      );
    }

    // Find poll - must be owned by this teacher
    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: memberCtx.schoolId,
      createdBy: memberCtx.userId,
      createdByRole: "teacher",
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }

    // Only allow deletion in draft, pending_approval, or rejected status
    const deletableStatuses = ["draft", "pending_approval", "rejected"];
    if (!deletableStatuses.includes(poll.status)) {
      return NextResponse.json(
        { error: `Cannot delete poll in ${poll.status} status` },
        { status: 403 }
      );
    }

    await CommunityPoll.deleteOne({ _id: poll._id });

    return NextResponse.json({
      message: "Poll deleted successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting teacher poll:", error);
    return NextResponse.json(
      { error: "Failed to delete poll" },
      { status: 500 }
    );
  }
}
