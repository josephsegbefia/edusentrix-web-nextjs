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

const ReopenSchema = z.object({
  reason: z.string().trim().min(1, "Reopen reason is required").max(500),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId, roles } = await requireFinanceStaff();
    await connectToDatabase();

    if (!roles.includes("school_admin")) {
      return NextResponse.json(
        { ok: false, error: "Only school administrators can reopen locked reconciliation sessions." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid session ID" }, { status: 400 });
    }

    const parsed = ReopenSchema.safeParse(await req.json());
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

    if (session.status !== "locked") {
      return NextResponse.json(
        { ok: false, error: "Only locked sessions can be reopened." },
        { status: 400 }
      );
    }

    const result = await ReconciliationSession.updateOne(
      { _id: session._id, schoolId: schoolIdObj, status: "locked" },
      {
        $set: {
          status: "reopened",
          reopenedBy: userIdObj,
          reopenedAt: now,
          reopenReason: parsed.data.reason,
          completedAt: null,
          currentStep: "review",
        },
        $push: {
          timeline: {
            action: "session_reopened",
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
      type: "reconciliation.session_reopened",
      entityType: "ReconciliationSession",
      entityId: session._id,
      description: `Reopened locked reconciliation session: ${session.label}`,
      metadata: { reason: parsed.data.reason },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to reopen session.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
