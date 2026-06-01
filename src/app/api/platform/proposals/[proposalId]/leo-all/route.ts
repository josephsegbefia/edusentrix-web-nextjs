import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { hashProposalContent, logProposalActivity } from "@/lib/proposals/utils";
import { serializeProposal } from "@/lib/proposals/serialize";
import {
  generateProposalSectionWithLeo,
  loadProposalBrandingForLeo,
  loadSubscriptionTiersForProposal,
  mergeDefaultProposalSections,
} from "@/lib/proposals/leo-generation";

const LeoAllSchema = z.object({
  instruction: z.string().trim().max(600).optional().nullable(),
  tone: z.enum(["formal", "executive", "warm", "simple"]).default("formal"),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.update");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const { proposalId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ success: false, error: "Invalid proposal id" }, { status: 400 });
    }

    const parsed = LeoAllSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    if (["accepted", "rejected"].includes(proposal.status)) {
      return NextResponse.json({ success: false, error: "Accepted or rejected proposals cannot be edited. Duplicate it first." }, { status: 409 });
    }

    const subscriptionTiers = await loadSubscriptionTiersForProposal(proposal.proposalType);
    const branding = await loadProposalBrandingForLeo();
    const sections = mergeDefaultProposalSections(proposal.sections as unknown as Parameters<typeof mergeDefaultProposalSections>[0]);
    const generatedSections = [];
    let source: "leo" | "fallback" = "fallback";

    for (const section of sections) {
      const generated = await generateProposalSectionWithLeo({
        proposal,
        section,
        subscriptionTiers,
        branding,
        instruction: parsed.data.instruction,
        tone: parsed.data.tone,
      });
      if (generated.source === "leo") source = "leo";
      generatedSections.push({
        ...section,
        content: generated.content,
      });
    }

    proposal.sections = generatedSections;
    proposal.version += 1;
    proposal.contentHash = hashProposalContent({
      schoolName: proposal.schoolName,
      title: proposal.title,
      selectedModules: proposal.selectedModules,
      sections: proposal.sections,
      pricing: proposal.pricing,
    });

    await proposal.save();
    await logProposalActivity({
      proposalId: proposal._id,
      action: "updated",
      message: "Leo generated draft content for all proposal sections.",
      actorId: gate.actor.userId,
      metadata: { source, sectionCount: generatedSections.length },
    });

    return NextResponse.json({
      success: true,
      isDraft: true,
      disclaimer: "Leo generated draft proposal copy. Review and edit before sending.",
      data: { proposal: serializeProposal(proposal.toObject()), source },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Leo could not generate proposal content" },
      { status: 500 },
    );
  }
}
