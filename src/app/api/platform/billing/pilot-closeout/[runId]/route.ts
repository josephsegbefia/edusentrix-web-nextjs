import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { PilotCloseoutRun } from "@/models/PilotCloseoutRun";
import { User } from "@/models/User";

const ReviewPilotCloseoutSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional().nullable().default(null),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { runId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(runId)) {
      return NextResponse.json(
        { success: false, error: "Invalid pilot closeout run id." },
        { status: 400 }
      );
    }

    const body = ReviewPilotCloseoutSchema.parse(await req.json());
    const actor = await User.findById(gate.me._id)
      .select("email")
      .lean<{ email?: string } | null>();

    const updated = await PilotCloseoutRun.findByIdAndUpdate(
      new mongoose.Types.ObjectId(runId),
      {
        $set: {
          approvalStatus: body.decision,
          reviewedBy: gate.me._id,
          reviewedByEmail: actor?.email || null,
          reviewedAt: new Date(),
          reviewNote: body.note,
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Pilot closeout run not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        approvalStatus: updated.approvalStatus,
        reviewedByEmail: updated.reviewedByEmail || null,
        reviewedAt: updated.reviewedAt?.toISOString?.() || null,
        reviewNote: updated.reviewNote || null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid pilot closeout review payload." },
        { status: 400 }
      );
    }

    console.error("Failed to review pilot closeout run:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to review pilot closeout run",
      },
      { status: 500 }
    );
  }
}
