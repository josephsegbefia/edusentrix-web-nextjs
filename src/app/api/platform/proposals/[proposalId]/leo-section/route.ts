import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { logProposalActivity } from "@/lib/proposals/utils";
import {
  generateProposalSectionWithLeo,
  loadProposalBrandingForLeo,
  loadSubscriptionTiersForProposal,
} from "@/lib/proposals/leo-generation";

const LeoSectionSchema = z.object({
  sectionKey: z.string().trim().min(1),
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
    const parsed = LeoSectionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    const section = proposal.sections.find((item) => item.key === parsed.data.sectionKey);
    if (!section) return NextResponse.json({ success: false, error: "Section not found" }, { status: 404 });

    const subscriptionTiers = await loadSubscriptionTiersForProposal(proposal.proposalType);
    const branding = await loadProposalBrandingForLeo();
    const { content: draft, source } = await generateProposalSectionWithLeo({
      proposal,
      section,
      subscriptionTiers,
      branding,
      instruction: parsed.data.instruction,
      tone: parsed.data.tone,
    });

    await logProposalActivity({
      proposalId: proposal._id,
      action: "updated",
      message: `Leo generated draft content for "${section.title}".`,
      actorId: gate.actor.userId,
      metadata: { sectionKey: section.key, source },
    });

    return NextResponse.json({
      success: true,
      isDraft: true,
      disclaimer: "Leo generated draft proposal copy. Review and edit before sending.",
      data: { content: draft, source },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Leo could not generate section content" },
      { status: 500 },
    );
  }
}
