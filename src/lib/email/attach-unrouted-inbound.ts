import "server-only";

import { EmailMessage } from "@/models/EmailMessage";
import { EmailThread } from "@/models/EmailThread";
import { handleProposalInboundReply } from "@/lib/proposals/reply-handler";
import { updateThreadAfterMessage } from "@/lib/email/threading";

/**
 * Best-effort attach of an inbound EmailMessage that was persisted without a
 * thread. Residual leftover unrouted inbound is not a cron dependency.
 */
export async function attachUnroutedInboundMessage(emailMessageId: string): Promise<{
  attached: boolean;
  reason?: string;
}> {
  const message = await EmailMessage.findById(emailMessageId);
  if (!message) {
    return { attached: false, reason: "EmailMessage not found" };
  }
  if (message.threadId) {
    return { attached: true };
  }

  const routingToken = message.routingToken;
  const thread = routingToken
    ? await EmailThread.findOne({ routingToken })
        .select("_id mailboxScope relatedEntityType relatedEntityId")
        .lean()
    : null;

  if (!thread) {
    return {
      attached: false,
      reason: routingToken
        ? "No thread found for routing token"
        : "Inbound message has no routing token",
    };
  }

  await EmailMessage.findByIdAndUpdate(message._id, {
    $set: {
      threadId: thread._id,
      status: "received",
    },
  });
  await updateThreadAfterMessage(String(thread._id), "inbound");

  if (
    thread.mailboxScope === "platform" &&
    thread.relatedEntityType === "Proposal" &&
    thread.relatedEntityId
  ) {
    await handleProposalInboundReply({
      proposalId: String(thread.relatedEntityId),
      fromEmail: message.from,
      fromName: message.fromName ?? null,
      subject: message.subject,
      threadId: String(thread._id),
    });
  }

  return { attached: true };
}
