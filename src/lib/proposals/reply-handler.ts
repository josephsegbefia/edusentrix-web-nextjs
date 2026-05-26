import "server-only";

import mongoose from "mongoose";
import { Proposal } from "@/models/Proposal";
import { logProposalActivity } from "@/lib/proposals/utils";
// Import directly from the service file to avoid the circular chain:
// receive-brevo-inbound → reply-handler → @/lib/email → receive-brevo-inbound
import { sendTrackedBrevoEmail } from "@/lib/email/services/send-brevo-email";

const PLATFORM_GROWTH_ADMIN_EMAIL = process.env.PLATFORM_GROWTH_ADMIN_EMAIL ?? "";

/**
 * Called when an inbound email is routed to a thread that is linked to a Proposal.
 * Logs activity on the proposal and sends a notification to the platform growth admin.
 */
export async function handleProposalInboundReply(input: {
  proposalId: string;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  threadId?: string | null;
}): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(input.proposalId)) return;

  const proposal = await Proposal.findById(input.proposalId)
    .select("_id schoolName status")
    .lean();
  if (!proposal) return;

  const senderLabel = input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail;

  await logProposalActivity({
    proposalId: proposal._id,
    action: "reply_received",
    message: `Reply received from ${senderLabel} — "${input.subject}"`,
    actorId: null,
    metadata: { fromEmail: input.fromEmail, subject: input.subject, threadId: input.threadId ?? null },
  });

  // Advance status from "sent" to "followed_up" automatically.
  if (proposal.status === "sent") {
    await Proposal.findByIdAndUpdate(proposal._id, {
      $set: { status: "followed_up", lastFollowedUpAt: new Date() },
    });
  }

  // Notify the platform growth admin.
  if (!PLATFORM_GROWTH_ADMIN_EMAIL) return;

  try {
    await sendTrackedBrevoEmail({
      to: PLATFORM_GROWTH_ADMIN_EMAIL,
      subject: `[EduSentrix] Reply received — ${proposal.schoolName}`,
      htmlContent: [
        `<p><strong>Proposal reply received</strong></p>`,
        `<p>School: <strong>${proposal.schoolName}</strong></p>`,
        `<p>From: ${senderLabel}</p>`,
        `<p>Subject: ${input.subject}</p>`,
        `<p>Review and respond from the <a href="https://app.tryedusentrix.app/platform/proposals">Proposal Center</a>.</p>`,
      ].join("\n"),
      templateKey: "PLATFORM_ADMIN_REPLY_NOTIFICATION",
      actorId: null,
      actorRole: "system",
      threadType: "support",
      relatedEntityType: "Proposal",
      relatedEntityId: input.proposalId,
    });
  } catch (err) {
    // Non-critical — log but don't throw.
    console.error("[proposal-reply-handler] Notification email failed", err);
  }
}
