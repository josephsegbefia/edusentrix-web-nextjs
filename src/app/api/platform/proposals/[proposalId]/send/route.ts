import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { Proposal } from "@/models/Proposal";
import { ProposalSendLog } from "@/models/ProposalSendLog";
import { logProposalActivity } from "@/lib/proposals/utils";
import { serializeProposalSendLog } from "@/lib/proposals/serialize";

const SendProposalSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(3).max(300),
  bodyHtml: z.string().min(10),
  includeGeneratedFile: z.boolean().default(true),
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
    if (!proposal) return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    const parsed = SendProposalSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    if (parsed.data.includeGeneratedFile && (!proposal.pdfDataBase64 || proposal.lastGeneratedVersion !== proposal.version)) {
      return NextResponse.json({ success: false, error: "Generate an up-to-date proposal file before sending" }, { status: 409 });
    }

    const attachments = parsed.data.includeGeneratedFile && proposal.pdfDataBase64
      ? [{
          name: proposal.pdfFileName?.replace(/\.html?$/i, ".pdf") || "proposal.pdf",
          mimeType: "application/pdf",
          contentBase64: proposal.pdfDataBase64,
        }]
      : undefined;

    const result = await sendTrackedBrevoEmail({
      to: parsed.data.to,
      subject: parsed.data.subject,
      htmlContent: parsed.data.bodyHtml,
      textContent: parsed.data.bodyHtml.replace(/<[^>]+>/g, " "),
      attachments,
      templateKey: "PLATFORM_PROPOSAL",
      actorId: String(gate.actor.userId),
      actorRole: "platform_admin",
      threadType: "support",
      relatedEntityType: "Proposal",
      relatedEntityId: String(proposal._id),
    });

    const log = await ProposalSendLog.create({
      proposalId: proposal._id,
      recipientEmail: parsed.data.to,
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      attachmentName: attachments?.[0]?.name || null,
      status: result.status === "sent" ? "sent" : "failed",
      emailMessageId: result.messageId ? new mongoose.Types.ObjectId(result.messageId) : null,
      providerMessageId: result.providerMessageId || null,
      errorMessage: result.status === "failed" ? "Email provider rejected or suppressed the message" : null,
      sentBy: gate.actor.userId,
      sentAt: result.status === "sent" ? new Date() : null,
    });

    if (result.status === "sent") {
      proposal.status = "sent";
      proposal.sentAt = new Date();
      proposal.sentBy = gate.actor.userId;
      proposal.lastSentVersion = proposal.version;
      await proposal.save();
    }

    await logProposalActivity({
      proposalId: proposal._id,
      action: "sent",
      message: result.status === "sent" ? `Proposal sent to ${parsed.data.to}.` : `Proposal send failed for ${parsed.data.to}.`,
      actorId: gate.actor.userId,
      metadata: { sendLogId: String(log._id), emailMessageId: result.messageId || null },
    });

    return NextResponse.json({ success: true, data: { sendLog: serializeProposalSendLog(log), email: result } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send proposal" },
      { status: 500 },
    );
  }
}
