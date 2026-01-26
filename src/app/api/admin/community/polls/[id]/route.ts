// src/app/api/admin/community/polls/[id]/route.ts
/**
 * Admin API for single poll - get, update, delete.
 * V2: Enforces edit/lock policy based on poll status.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import { User } from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// Validation - Cosmetic-only updates for live polls
// ============================================================================

const CosmeticUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  revealResults: z.enum(["live", "after_close", "admin_only"]).optional(),
  "schedule.endDate": z.string().datetime().optional().nullable(),
});

// Full update schema for draft/pending polls
const FullUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  schedule: z.object({
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    timezone: z.string().optional(),
  }).optional(),
  audience: z.object({
    scope: z.enum(["school", "grade", "class", "staff", "parents", "students"]).optional(),
    gradeIds: z.array(z.string()).optional(),
    classGroupIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
  }).optional(),
  questions: z.array(z.object({
    _id: z.string().optional(),
    prompt: z.string().min(1).max(500),
    type: z.enum(["single_choice", "multi_choice", "ranked_choice", "likert", "yes_no", "comment"]),
    options: z.array(z.object({
      _id: z.string().optional(),
      label: z.string().min(1).max(200),
      imageUrl: z.string().url().optional().nullable(),
      order: z.number().min(0).default(0),
    })).optional(),
    required: z.boolean().default(true),
    allowOther: z.boolean().default(false),
    order: z.number().min(0).default(0),
  })).optional(),
  allowAnonymous: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  revealResults: z.enum(["live", "after_close", "admin_only"]).optional(),
});

// ============================================================================
// GET - Single poll detail
// ============================================================================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void CommunityPoll.modelName;
    void User.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    })
      .populate("createdBy", "firstName lastName email")
      .populate("approvedBy", "firstName lastName")
      .lean();

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const p = poll as any;

    return NextResponse.json({
      id: String(p._id),
      title: p.title,
      description: p.description || null,
      coverImageUrl: p.coverImageUrl || null,
      tags: p.tags || [],
      status: p.status,
      approvalStatus: p.approvalStatus,
      approvalNotes: p.approvalNotes || null,
      schedule: {
        startDate: p.schedule?.startDate ? new Date(p.schedule.startDate).toISOString() : null,
        endDate: p.schedule?.endDate ? new Date(p.schedule.endDate).toISOString() : null,
        timezone: p.schedule?.timezone || "UTC",
      },
      audience: p.audience,
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
      allowAnonymous: p.allowAnonymous,
      allowComments: p.allowComments,
      revealResults: p.revealResults,
      totalVotes: p.totalVotes || 0,
      eligibleCount: p.eligibleCount || 0,
      participationRate: p.participationRate || 0,
      createdBy: p.createdBy
        ? {
            id: String(p.createdBy._id),
            name: `${p.createdBy.firstName} ${p.createdBy.lastName}`.trim(),
            email: p.createdBy.email,
          }
        : null,
      createdByRole: p.createdByRole,
      approvedBy: p.approvedBy
        ? {
            id: String(p.approvedBy._id),
            name: `${p.approvedBy.firstName} ${p.approvedBy.lastName}`.trim(),
          }
        : null,
      approvedAt: p.approvedAt ? new Date(p.approvedAt).toISOString() : null,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching poll:", error);
    return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 });
  }
}

// ============================================================================
// PATCH - Update poll (with V2 lock policy)
// ============================================================================

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const poll = await CommunityPoll.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const body = await req.json();

    // V2 Lock Policy:
    // - Draft/Pending: fully editable
    // - Live: only cosmetic edits (title, description, coverImageUrl, tags, revealResults, endDate extension)
    // - Closed/Archived: immutable (except status -> archived)

    if (poll.status === "closed" || poll.status === "archived") {
      return NextResponse.json(
        { error: "Cannot edit a closed or archived poll" },
        { status: 400 }
      );
    }

    if (poll.status === "live") {
      // Only allow cosmetic updates
      const parsed = CosmeticUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Only cosmetic edits allowed for live polls", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updates.title = parsed.data.title;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;
      if (parsed.data.coverImageUrl !== undefined) updates.coverImageUrl = parsed.data.coverImageUrl;
      if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
      if (parsed.data.revealResults !== undefined) updates.revealResults = parsed.data.revealResults;
      if (parsed.data["schedule.endDate"] !== undefined) {
        updates["schedule.endDate"] = parsed.data["schedule.endDate"]
          ? new Date(parsed.data["schedule.endDate"])
          : null;
      }

      await CommunityPoll.updateOne({ _id: poll._id }, { $set: updates });

      return NextResponse.json({ message: "Poll updated successfully" });
    }

    // Draft or pending_approval: full edits allowed
    const parsed = FullUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    const { title, description, coverImageUrl, tags, schedule, audience, questions, allowAnonymous, allowComments, revealResults } = parsed.data;

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (coverImageUrl !== undefined) updates.coverImageUrl = coverImageUrl;
    if (tags !== undefined) updates.tags = tags;
    if (allowAnonymous !== undefined) updates.allowAnonymous = allowAnonymous;
    if (allowComments !== undefined) updates.allowComments = allowComments;
    if (revealResults !== undefined) updates.revealResults = revealResults;

    if (schedule) {
      updates.schedule = {
        startDate: schedule.startDate ? new Date(schedule.startDate) : poll.schedule?.startDate,
        endDate: schedule.endDate ? new Date(schedule.endDate) : poll.schedule?.endDate,
        timezone: schedule.timezone || poll.schedule?.timezone || "UTC",
      };
    }

    if (audience) {
      updates.audience = {
        scope: audience.scope || poll.audience.scope,
        gradeIds: audience.gradeIds?.map((id) => new mongoose.Types.ObjectId(id)) || poll.audience.gradeIds,
        classGroupIds: audience.classGroupIds?.map((id) => new mongoose.Types.ObjectId(id)) || poll.audience.classGroupIds,
        roles: audience.roles || poll.audience.roles,
      };
    }

    if (questions) {
      updates.questions = questions.map((q, qIndex) => ({
        _id: q._id ? new mongoose.Types.ObjectId(q._id) : new mongoose.Types.ObjectId(),
        prompt: q.prompt,
        type: q.type,
        required: q.required,
        allowOther: q.allowOther,
        order: q.order ?? qIndex,
        options: q.options?.map((opt, oIndex) => ({
          _id: opt._id ? new mongoose.Types.ObjectId(opt._id) : new mongoose.Types.ObjectId(),
          label: opt.label,
          imageUrl: opt.imageUrl || null,
          order: opt.order ?? oIndex,
        })),
      }));
    }

    await CommunityPoll.updateOne({ _id: poll._id }, { $set: updates });

    return NextResponse.json({ message: "Poll updated successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating poll:", error);
    return NextResponse.json({ error: "Failed to update poll" }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete poll (only draft/pending)
// ============================================================================

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const pollIdObj = new mongoose.Types.ObjectId(id);

    const poll = await CommunityPoll.findOne({
      _id: pollIdObj,
      schoolId: schoolIdObj,
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    // Only allow deletion of draft or pending polls
    if (!["draft", "pending_approval"].includes(poll.status)) {
      return NextResponse.json(
        { error: "Only draft or pending polls can be deleted" },
        { status: 400 }
      );
    }

    // Delete related votes (if any exist)
    await CommunityPollVote.deleteMany({ pollId: pollIdObj });

    // Delete the poll
    await CommunityPoll.deleteOne({ _id: pollIdObj });

    return NextResponse.json({ message: "Poll deleted successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting poll:", error);
    return NextResponse.json({ error: "Failed to delete poll" }, { status: 500 });
  }
}
