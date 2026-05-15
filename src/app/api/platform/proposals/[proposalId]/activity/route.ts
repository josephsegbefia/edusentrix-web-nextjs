import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ProposalActivity } from "@/models/ProposalActivity";
import { serializeProposalActivity } from "@/lib/proposals/serialize";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { proposalId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ success: false, error: "Invalid proposal id" }, { status: 400 });
    }
    const activities = await ProposalActivity.find({ proposalId: new mongoose.Types.ObjectId(proposalId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({ success: true, data: { activities: activities.map(serializeProposalActivity) } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load proposal activity" },
      { status: 500 },
    );
  }
}
