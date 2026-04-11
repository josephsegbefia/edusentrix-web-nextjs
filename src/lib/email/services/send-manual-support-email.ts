import "server-only";

import { EmailMessage } from "@/models/EmailMessage";
import { spacemailSend } from "../providers/spaceship-provider";
import { findOrCreateThread, updateThreadAfterMessage } from "../threading";
import { buildPlatformReplyAlias, generateRoutingToken } from "../routing";

export interface SendManualSupportEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  fromEmail?: string;
  fromName?: string;

  actorId: string;
  actorName: string;
  actorRole: string;

  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  inReplyToThreadId?: string | null;
}

export interface SendManualSupportEmailResult {
  messageId: string;
  providerMessageId?: string;
  threadId: string;
}

/**
 * Send a manual one-to-one email from platform support via Spacemail SMTP.
 * Creates a thread and audit record.
 */
export async function sendManualSupportEmail(
  input: SendManualSupportEmailInput,
): Promise<SendManualSupportEmailResult> {
  const thread = await findOrCreateThread({
    mailboxScope: "platform",
    mailboxKey: "platform_support",
    subject: input.subject,
    threadType: "support",
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    participantEmail: input.to,
    participantName: input.toName,
    participantRoleHint: null,
  });

  const routingToken = thread.routingToken || generateRoutingToken();
  const replyAlias = buildPlatformReplyAlias("support", routingToken);

  const message = await EmailMessage.create({
    provider: "spaceship",
    direction: "outbound",
    mailboxScope: "platform",
    mailboxKey: "platform_support",
    from: input.fromEmail || process.env.SPACEMAIL_SMTP_USER || "",
    fromName: input.fromName || null,
    to: input.to,
    replyTo: replyAlias,
    subject: input.subject,
    htmlBody: input.htmlContent,
    textBody: input.textContent || null,
    status: "queued",
    messageClass: "support",
    trafficClass: "manual",
    priority: "normal",
    sensitivity: "low",
    secureContentMode: "none",
    threadId: thread._id,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    replyAlias,
    routingToken,
  });

  try {
    const result = await spacemailSend({
      to: input.to,
      toName: input.toName,
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      replyTo: replyAlias,
    });

    await EmailMessage.findByIdAndUpdate(message._id, {
      $set: {
        status: "sent",
        providerMessageId: result.providerMessageId || null,
        sentAt: new Date(),
      },
    });

    await updateThreadAfterMessage(String(thread._id), "outbound");

    return {
      messageId: String(message._id),
      providerMessageId: result.providerMessageId,
      threadId: String(thread._id),
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : String(error);
    await EmailMessage.findByIdAndUpdate(message._id, {
      $set: { status: "failed", failureReason: msg },
    });
    throw error;
  }
}
