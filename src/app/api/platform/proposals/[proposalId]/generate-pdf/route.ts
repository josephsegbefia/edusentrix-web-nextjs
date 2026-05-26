import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { ProposalBranding } from "@/models/ProposalBranding";
import { renderProposalPdf } from "@/lib/proposals/render-pdf";
import { ensureDefaultProposalData, logProposalActivity } from "@/lib/proposals/utils";
import { serializeProposal } from "@/lib/proposals/serialize";

function getLogoDataUri(): string | null {
  // Prefer the transparent variant on white PDF backgrounds
  const candidates = [
    path.join(process.cwd(), "public", "logo", "edusentrix-logo-transparent.png"),
    path.join(process.cwd(), "public", "logo", "edusentrix-logo.png"),
  ];
  for (const logoPath of candidates) {
    try {
      const data = fs.readFileSync(logoPath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch {
      // try next
    }
  }
  return null;
}

function safePdfSlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

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

    const pdfBuffer = await renderProposalPdf(proposal, branding, getLogoDataUri());

    proposal.pdfDataBase64 = pdfBuffer.toString("base64");
    proposal.pdfFileName = `${safePdfSlug(proposal.schoolName)}-proposal.pdf`;
    proposal.lastGeneratedAt = new Date();
    proposal.lastGeneratedVersion = proposal.version;
    if (proposal.status === "draft") proposal.status = "ready";
    await proposal.save();

    await logProposalActivity({
      proposalId: proposal._id,
      action: "pdf_generated",
      message: "Proposal PDF generated.",
      actorId: gate.actor.userId,
      metadata: { version: proposal.version },
    });

    return NextResponse.json({ success: true, data: serializeProposal(proposal.toObject()) });
  } catch (error) {
    console.error("[generate-pdf]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate proposal PDF" },
      { status: 500 },
    );
  }
}
