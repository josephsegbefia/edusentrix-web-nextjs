import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { ProposalActivity } from "@/models/ProposalActivity";
import { ProposalSendLog } from "@/models/ProposalSendLog";
import { UpdateProposalSchema } from "@/lib/proposals/validators";
import { hashProposalContent, logProposalActivity, sanitizeProposalHtml } from "@/lib/proposals/utils";
import { serializeProposal, serializeProposalActivity, serializeProposalSendLog } from "@/lib/proposals/serialize";

async function getProposalOr404(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Proposal.findById(id);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { proposalId } = await ctx.params;
    const proposal = await getProposalOr404(proposalId);
    if (!proposal) {
      return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    }

    const [activities, sendLogs] = await Promise.all([
      ProposalActivity.find({ proposalId: proposal._id }).sort({ createdAt: -1 }).limit(50).lean(),
      ProposalSendLog.find({ proposalId: proposal._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        proposal: serializeProposal(proposal),
        activities: activities.map(serializeProposalActivity),
        sendLogs: sendLogs.map(serializeProposalSendLog),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load proposal" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.update");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { proposalId } = await ctx.params;
    const proposal = await getProposalOr404(proposalId);
    if (!proposal) {
      return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    }
    if (["accepted", "rejected"].includes(proposal.status)) {
      return NextResponse.json({ success: false, error: "Accepted or rejected proposals cannot be edited. Duplicate it first." }, { status: 409 });
    }

    const parsed = UpdateProposalSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const data = parsed.data;
    if (data.schoolName !== undefined) proposal.schoolName = data.schoolName;
    if (data.schoolLocation !== undefined) proposal.schoolLocation = data.schoolLocation || "";
    if (data.recipientName !== undefined) proposal.recipientName = data.recipientName || "";
    if (data.recipientTitle !== undefined) proposal.recipientTitle = data.recipientTitle || "";
    if (data.recipientEmail !== undefined) proposal.recipientEmail = data.recipientEmail || "";
    if (data.recipientPhone !== undefined) proposal.recipientPhone = data.recipientPhone || "";
    if (data.title !== undefined) proposal.title = data.title;
    if (data.selectedModules !== undefined) proposal.selectedModules = data.selectedModules;
    if (data.sections !== undefined) {
      proposal.sections = data.sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          ...section,
          subtitle: section.subtitle || "",
          content: sanitizeProposalHtml(section.content),
          pageBreakBefore: Boolean(section.pageBreakBefore),
          pageBreakAfter: Boolean(section.pageBreakAfter),
        }));
    }
    if (data.pricing !== undefined) proposal.pricing = data.pricing;
    if (data.nextFollowUpDate !== undefined) proposal.nextFollowUpDate = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;
    if (data.followUpNotes !== undefined) proposal.followUpNotes = data.followUpNotes || "";
    if (data.internalNotes !== undefined) proposal.internalNotes = data.internalNotes || "";
    if (data.status !== undefined) proposal.status = data.status;

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
      action: data.status ? "status_changed" : "updated",
      message: data.status ? `Proposal status changed to ${data.status.replace(/_/g, " ")}.` : "Proposal updated.",
      actorId: gate.actor.userId,
    });

    return NextResponse.json({ success: true, data: serializeProposal(proposal) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update proposal" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.archive");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { proposalId } = await ctx.params;
    const proposal = await getProposalOr404(proposalId);
    if (!proposal) {
      return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    }
    if (proposal.status === "archived") {
      await Promise.all([
        ProposalSendLog.deleteMany({ proposalId: proposal._id }),
        ProposalActivity.deleteMany({ proposalId: proposal._id }),
        Proposal.deleteOne({ _id: proposal._id }),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          deleted: true,
          permanentlyDeleted: true,
          id: proposalId,
        },
      });
    }

    proposal.status = "archived";
    await proposal.save();
    await logProposalActivity({
      proposalId: proposal._id,
      action: "archived",
      message: "Proposal archived.",
      actorId: gate.actor.userId,
    });
    return NextResponse.json({ success: true, data: serializeProposal(proposal) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete proposal" },
      { status: 500 },
    );
  }
}
