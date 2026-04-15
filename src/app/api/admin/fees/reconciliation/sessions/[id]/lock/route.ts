import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationSession } from "@/models/ReconciliationSession";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const LockSchema = z.object({
  reason: z.string().trim().min(1, "Lock reason is required").max(500),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid session ID" }, { status: 400 });
    }

    const parsed = LockSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const now = new Date();

    const session = await ReconciliationSession.findOne({
      _id: id,
      schoolId: schoolIdObj,
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    if (session.status === "locked") {
      return NextResponse.json({ ok: false, error: "Session is already locked." }, { status: 400 });
    }

    if (session.status === "preparing") {
      return NextResponse.json(
        { ok: false, error: "Cannot lock a session that is still in preparation." },
        { status: 400 }
      );
    }

    const result = await ReconciliationSession.updateOne(
      { _id: session._id, schoolId: schoolIdObj, status: { $ne: "locked" } },
      {
        $set: {
          status: "locked",
          lockedBy: userIdObj,
          lockedAt: now,
          lockReason: parsed.data.reason,
          finalizeNotes: parsed.data.notes || session.finalizeNotes || null,
          completedAt: now,
          currentStep: "finalize",
        },
        $push: {
          timeline: {
            action: "session_locked",
            userId: userIdObj,
            at: now,
            reason: parsed.data.reason,
            notes: parsed.data.notes || null,
          },
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, error: "Session was modified concurrently. Refresh and try again." },
        { status: 409 }
      );
    }

    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userIdObj),
      type: "reconciliation.session_locked",
      entityType: "ReconciliationSession",
      entityId: session._id,
      description: `Locked reconciliation session: ${session.label}`,
      metadata: { reason: parsed.data.reason },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to lock session.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
