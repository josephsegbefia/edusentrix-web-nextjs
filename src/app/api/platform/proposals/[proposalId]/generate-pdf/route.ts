import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { ProposalBranding } from "@/models/ProposalBranding";
import { renderProposalHtml } from "@/lib/proposals/render";
import { ensureDefaultProposalData, logProposalActivity } from "@/lib/proposals/utils";
import { serializeProposal } from "@/lib/proposals/serialize";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.generatePdf");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    await ensureDefaultProposalData(gate.actor.userId);
    const { proposalId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ success: false, error: "Invalid proposal id" }, { status: 400 });
    }
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    const branding = await ProposalBranding.findOne({});
    const html = renderProposalHtml(proposal, branding);

    proposal.pdfDataBase64 = Buffer.from(html, "utf8").toString("base64");
    proposal.pdfFileName = `${proposal.schoolName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-proposal.html`;
    proposal.lastGeneratedAt = new Date();
    proposal.lastGeneratedVersion = proposal.version;
    if (proposal.status === "draft") proposal.status = "ready";
    await proposal.save();

    await logProposalActivity({
      proposalId: proposal._id,
      action: "pdf_generated",
      message: "Proposal preview file generated.",
      actorId: gate.actor.userId,
      metadata: { version: proposal.version },
    });

    return NextResponse.json({ success: true, data: serializeProposal(proposal) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate proposal file" },
      { status: 500 },
    );
  }
}
