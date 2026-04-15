import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationSession } from "@/models/ReconciliationSession";
import { User } from "@/models/User";
import { recordActivity } from "@/lib/audit/recordActivity";

const CreateSchema = z.object({
  label: z.string().trim().min(1).max(200),
  sourceTypes: z
    .array(z.enum(["gateway", "bank", "manual"]))
    .min(1)
    .max(3),
  dateRange: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })
    .optional(),
  prepareNotes: z.string().trim().max(2000).optional(),
});

function serializeSession(session: Record<string, unknown>, user?: Record<string, unknown> | null) {
  const s = session as Record<string, unknown>;
  return {
    id: String(s._id),
    schoolId: String(s.schoolId),
    label: s.label,
    status: s.status,
    currentStep: s.currentStep,
    createdBy: user
      ? { id: String((user as Record<string, unknown>)._id), name: (user as Record<string, unknown>).name, email: (user as Record<string, unknown>).email }
      : s.createdBy ? String(s.createdBy) : null,
    sourceTypes: s.sourceTypes,
    dateRange: s.dateRange,
    prepareNotes: s.prepareNotes || null,
    importNotes: s.importNotes || null,
    reviewNotes: s.reviewNotes || null,
    finalizeNotes: s.finalizeNotes || null,
    runIds: Array.isArray(s.runIds) ? (s.runIds as unknown[]).map(String) : [],
    summary: s.summary,
    reportVerificationId: s.reportVerificationId || null,
    lockedBy: s.lockedBy ? String(s.lockedBy) : null,
    lockedAt: s.lockedAt || null,
    lockReason: s.lockReason || null,
    reopenedBy: s.reopenedBy ? String(s.reopenedBy) : null,
    reopenedAt: s.reopenedAt || null,
    reopenReason: s.reopenReason || null,
    timeline: s.timeline,
    completedAt: s.completedAt || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const statusFilter = req.nextUrl.searchParams.get("status");
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20)));
    const q = String(req.nextUrl.searchParams.get("q") || "").trim();

    const filter: Record<string, unknown> = { schoolId: schoolIdObj };
    if (statusFilter && ["preparing", "in_progress", "review", "locked", "reopened"].includes(statusFilter)) {
      filter.status = statusFilter;
    }
    if (q) {
      filter.label = { $regex: q, $options: "i" };
    }

    const [total, sessions] = await Promise.all([
      ReconciliationSession.countDocuments(filter),
      ReconciliationSession.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const userIds = [...new Set(sessions.map((s) => String(s.createdBy)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    return NextResponse.json({
      ok: true,
      data: {
        sessions: sessions.map((s) => serializeSession(
          s as unknown as Record<string, unknown>,
          userMap.get(String(s.createdBy)) as Record<string, unknown> | undefined
        )),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to list sessions.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { label, sourceTypes, dateRange, prepareNotes } = parsed.data;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const session = await ReconciliationSession.create({
      schoolId: schoolIdObj,
      label,
      status: "preparing",
      currentStep: "prepare",
      createdBy: userIdObj,
      sourceTypes,
      dateRange: dateRange
        ? {
            startDate: dateRange.startDate ? new Date(dateRange.startDate) : null,
            endDate: dateRange.endDate ? new Date(dateRange.endDate) : null,
          }
        : null,
      prepareNotes: prepareNotes || null,
      timeline: [
        {
          action: "session_created",
          userId: userIdObj,
          at: new Date(),
          notes: prepareNotes || null,
        },
      ],
    });

    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userIdObj),
      type: "reconciliation.session_created",
      entityType: "ReconciliationSession",
      entityId: session._id,
      description: `Created reconciliation session: ${label}`,
      metadata: { sourceTypes, label },
    });

    return NextResponse.json({
      ok: true,
      data: { id: String(session._id) },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to create session.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
