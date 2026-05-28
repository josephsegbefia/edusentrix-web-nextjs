import "server-only";

import { EmailMessage } from "@/models/EmailMessage";
import { EmailThread } from "@/models/EmailThread";
import { EmailDispatchJob } from "@/models/EmailDispatchJob";
import { parseReplyAlias } from "../routing";
import { findOrCreateThread, updateThreadAfterMessage } from "../threading";
import { handleProposalInboundReply } from "@/lib/proposals/reply-handler";

export interface BrevoInboundPayload {
  sender: { email: string; name?: string };
  recipients: Array<{ email: string }>;
  subject: string;
  htmlBody?: string | null;
  textBody?: string | null;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  rawPayload: Record<string, unknown>;
}

export interface InboundReceiveResult {
  messageId: string;
  threadId?: string;
  routed: boolean;
}

function normaliseEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function directPlatformMailboxForRecipient(email: string) {
  const normalized = normaliseEmail(email);
  const hello = normaliseEmail(process.env.BREVO_DEFAULT_FROM_EMAIL || "hello@tryedusentrix.app");
  const support = normaliseEmail(process.env.SUPPORT_EMAIL || process.env.BREVO_SUPPORT_FROM_EMAIL || "support@tryedusentrix.app");
  const billing = normaliseEmail(process.env.BREVO_BILLING_FROM_EMAIL || "billing@tryedusentrix.app");

  if (normalized === hello) return { mailboxKey: "platform_hello", threadType: "support" as const };
  if (normalized === support) return { mailboxKey: "platform_support", threadType: "support" as const };
  if (normalized === billing) return { mailboxKey: "platform_billing", threadType: "billing" as const };
  return null;
}

/**
 * Process an inbound email from Brevo inbound parsing.
 * 1. Persist the raw inbound message immediately
 * 2. Attempt to route to the correct thread
 * 3. If routing fails, create a dispatch job for retry
 */
export async function receiveBrevoInbound(
  payload: BrevoInboundPayload,
): Promise<InboundReceiveResult> {
  const routedRecipient = payload.recipients.find((recipient) =>
    parseReplyAlias(recipient.email),
  );
  const toAddress = routedRecipient?.email || payload.recipients[0]?.email;
  if (!toAddress) {
    throw new Error("No recipient address in inbound payload");
  }

  const existingByMsgId = payload.messageId
    ? await EmailMessage.findOne({
        messageIdHeader: payload.messageId,
        direction: "inbound",
      }).lean()
    : null;

  if (existingByMsgId) {
    return {
      messageId: String(existingByMsgId._id),
      threadId: existingByMsgId.threadId
        ? String(existingByMsgId.threadId)
        : undefined,
      routed: true,
    };
  }

  const parsed = parseReplyAlias(toAddress);

  let threadId: string | undefined;
  let schoolId: string | undefined;
  let mailboxScope: "platform" | "school" = "platform";
  let mailboxKey = "platform_support";
  let routedThread:
    | { relatedEntityType?: string | null; relatedEntityId?: unknown }
    | null = null;

  if (parsed) {
    if (parsed.scope === "school" && parsed.schoolId) {
      mailboxScope = "school";
      schoolId = parsed.schoolId;
      mailboxKey = `school:${parsed.schoolId}:general`;
    } else if (parsed.scope === "billing" && parsed.schoolId) {
      mailboxScope = "school";
      schoolId = parsed.schoolId;
      mailboxKey = `school:${parsed.schoolId}:billing`;
    } else if (parsed.scope === "platform") {
      mailboxScope = "platform";
      mailboxKey = `platform_${parsed.inboxKey || "support"}`;
    }

    const thread = await EmailThread.findOne({
      routingToken: parsed.routingToken,
    }).lean();

    if (thread) {
      threadId = String(thread._id);
      routedThread = thread;
    }
  } else {
    const directMailbox = directPlatformMailboxForRecipient(toAddress);
    if (directMailbox) {
      mailboxScope = "platform";
      mailboxKey = directMailbox.mailboxKey;
      const thread = await findOrCreateThread({
        mailboxScope,
        mailboxKey,
        subject: payload.subject || "(No subject)",
        threadType: directMailbox.threadType,
        participantEmail: payload.sender.email,
        participantName: payload.sender.name || null,
      });
      threadId = String(thread._id);
      routedThread = thread;
    }
  }

  const message = await EmailMessage.create({
    provider: "brevo",
    direction: "inbound",
    mailboxScope,
    mailboxKey,
    schoolId: schoolId || null,
    threadId: threadId || null,
    from: payload.sender.email,
    fromName: payload.sender.name || null,
    to: toAddress,
    subject: payload.subject || "(No subject)",
    htmlBody: payload.htmlBody || null,
    textBody: payload.textBody || null,
    status: threadId ? "received" : "routing",
    messageClass: "support",
    trafficClass: "system",
    priority: "normal",
    sensitivity: "low",
    secureContentMode: "none",
    messageIdHeader: payload.messageId || null,
    inReplyTo: payload.inReplyTo || null,
    referencesHeader: payload.references
      ? payload.references.split(/\s+/)
      : null,
    routingToken: parsed?.routingToken || null,
    receivedAt: new Date(),
  });

  if (threadId) {
    await updateThreadAfterMessage(threadId, "inbound");

    // Fire proposal reply notification if this thread is linked to a Proposal.
    if (parsed?.scope === "platform" && routedThread?.relatedEntityType === "Proposal" && routedThread.relatedEntityId) {
      void handleProposalInboundReply({
        proposalId: String(routedThread.relatedEntityId),
        fromEmail: payload.sender.email,
        fromName: payload.sender.name ?? null,
        subject: payload.subject,
        threadId,
      }).catch((err) =>
        console.error("[receive-brevo-inbound] proposal reply handler failed", err),
      );
    }

    return {
      messageId: String(message._id),
      threadId,
      routed: true,
    };
  }

  await EmailDispatchJob.create({
    kind: "inbound_route",
    emailMessageId: message._id,
    schoolId: schoolId || null,
    trafficClass: "system",
    priority: "normal",
    status: "pending",
    maxAttempts: 5,
    payload: { rawPayload: payload.rawPayload },
  });

  return {
    messageId: String(message._id),
    routed: false,
  };
}
