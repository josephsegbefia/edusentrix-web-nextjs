import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { logProposalActivity } from "@/lib/proposals/utils";

const BodySchema = z.object({
  note: z.string().trim().min(2).max(2000),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.send");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { proposalId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ success: false, error: "Invalid proposal id" }, { status: 400 });
    }
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    await logProposalActivity({
      proposalId: proposal._id,
      action: "reply_received",
      message: `Reply logged: ${parsed.data.note}`,
      actorId: gate.actor.userId,
    });

    // Advance status from "sent" to "followed_up" automatically.
    if (proposal.status === "sent") {
      proposal.status = "followed_up";
      proposal.lastFollowedUpAt = new Date();
      await proposal.save();
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to log reply" },
      { status: 500 },
    );
  }
}
