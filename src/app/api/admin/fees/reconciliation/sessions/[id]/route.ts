import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationSession } from "@/models/ReconciliationSession";
import { User } from "@/models/User";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UpdateSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  currentStep: z.string().trim().optional(),
  status: z.enum(["preparing", "in_progress", "review"]).optional(),
  prepareNotes: z.string().trim().max(2000).optional().nullable(),
  importNotes: z.string().trim().max(2000).optional().nullable(),
  reviewNotes: z.string().trim().max(2000).optional().nullable(),
  finalizeNotes: z.string().trim().max(2000).optional().nullable(),
  sourceTypes: z.array(z.enum(["gateway", "bank", "manual"])).min(1).max(3).optional(),
  dateRange: z
    .object({
      startDate: z.string().datetime().optional().nullable(),
      endDate: z.string().datetime().optional().nullable(),
    })
    .optional(),
  summary: z
    .object({
      totalIngested: z.number().optional(),
      matched: z.number().optional(),
      ambiguous: z.number().optional(),
      unmatched: z.number().optional(),
      ignored: z.number().optional(),
      paymentStatusUpdated: z.number().optional(),
      aiSuggestionsAccepted: z.number().optional(),
      aiSuggestionsRejected: z.number().optional(),
      manualMatches: z.number().optional(),
      errors: z.number().optional(),
    })
    .optional(),
  runId: z.string().optional(),
  timelineEvent: z
    .object({
      action: z.string(),
      reason: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    })
    .optional(),
});

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid session ID" }, { status: 400 });
    }

    const session = await ReconciliationSession.findOne({
      _id: id,
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
    }).lean();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    const userIds = [
      session.createdBy,
      session.lockedBy,
      session.reopenedBy,
    ].filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const createdByUser = userMap.get(String(session.createdBy));
    const lockedByUser = session.lockedBy ? userMap.get(String(session.lockedBy)) : null;
    const reopenedByUser = session.reopenedBy ? userMap.get(String(session.reopenedBy)) : null;

    return NextResponse.json({
      ok: true,
      data: {
        id: String(session._id),
        schoolId: String(session.schoolId),
        label: session.label,
        status: session.status,
        currentStep: session.currentStep,
        createdBy: createdByUser
          ? { id: String(createdByUser._id), name: createdByUser.name, email: createdByUser.email }
          : String(session.createdBy),
        sourceTypes: session.sourceTypes,
        dateRange: session.dateRange,
        prepareNotes: session.prepareNotes || null,
        importNotes: session.importNotes || null,
        reviewNotes: session.reviewNotes || null,
        finalizeNotes: session.finalizeNotes || null,
        runIds: session.runIds.map(String),
        summary: session.summary,
        reportVerificationId: session.reportVerificationId || null,
        lockedBy: lockedByUser
          ? { id: String(lockedByUser._id), name: lockedByUser.name, email: lockedByUser.email }
          : session.lockedBy ? String(session.lockedBy) : null,
        lockedAt: session.lockedAt || null,
        lockReason: session.lockReason || null,
        reopenedBy: reopenedByUser
          ? { id: String(reopenedByUser._id), name: reopenedByUser.name, email: reopenedByUser.email }
          : session.reopenedBy ? String(session.reopenedBy) : null,
        reopenedAt: session.reopenedAt || null,
        reopenReason: session.reopenReason || null,
        timeline: session.timeline,
        completedAt: session.completedAt || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to get session.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid session ID" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const sessionIdObj = new mongoose.Types.ObjectId(id);

    const session = await ReconciliationSession.findOne({
      _id: sessionIdObj,
      schoolId: schoolIdObj,
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    if (session.status === "locked") {
      return NextResponse.json(
        { ok: false, error: "Session is locked. Reopen it before making changes." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const $set: Record<string, unknown> = {};

    if (data.label) $set.label = data.label;
    if (data.currentStep) $set.currentStep = data.currentStep;
    if (data.status) $set.status = data.status;
    if (data.sourceTypes) $set.sourceTypes = data.sourceTypes;
    if (data.prepareNotes !== undefined) $set.prepareNotes = data.prepareNotes;
    if (data.importNotes !== undefined) $set.importNotes = data.importNotes;
    if (data.reviewNotes !== undefined) $set.reviewNotes = data.reviewNotes;
    if (data.finalizeNotes !== undefined) $set.finalizeNotes = data.finalizeNotes;

    if (data.dateRange) {
      if (data.dateRange.startDate !== undefined) $set["dateRange.startDate"] = data.dateRange.startDate ? new Date(data.dateRange.startDate) : null;
      if (data.dateRange.endDate !== undefined) $set["dateRange.endDate"] = data.dateRange.endDate ? new Date(data.dateRange.endDate) : null;
    }

    if (data.summary) {
      for (const [key, value] of Object.entries(data.summary)) {
        if (value !== undefined) $set[`summary.${key}`] = value;
      }
    }

    const $push: Record<string, unknown> = {};

    if (data.runId && mongoose.Types.ObjectId.isValid(data.runId)) {
      $push.runIds = new mongoose.Types.ObjectId(data.runId);
    }

    if (data.timelineEvent) {
      $push.timeline = {
        action: data.timelineEvent.action,
        userId: userIdObj,
        at: new Date(),
        reason: data.timelineEvent.reason || null,
        notes: data.timelineEvent.notes || null,
        metadata: data.timelineEvent.metadata || null,
      };
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (Object.keys($push).length > 0) update.$push = $push;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, data: { id } });
    }

    await ReconciliationSession.updateOne({ _id: sessionIdObj, schoolId: schoolIdObj }, update);

    return NextResponse.json({ ok: true, data: { id } });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to update session.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
