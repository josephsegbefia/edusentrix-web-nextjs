import "server-only";

import { processInboundEmail } from "./process-inbound-email";

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

/**
 * Optional backup inbound path via Brevo inbound parse webhook.
 * Primary inbound is IMAP sync on Spacemail (hello / support / billing).
 */
export async function receiveBrevoInbound(
  payload: BrevoInboundPayload,
): Promise<InboundReceiveResult> {
  return processInboundEmail({
    provider: "brevo",
    sender: payload.sender,
    recipients: payload.recipients.map((r) => r.email),
    subject: payload.subject,
    htmlBody: payload.htmlBody,
    textBody: payload.textBody,
    messageId: payload.messageId,
    inReplyTo: payload.inReplyTo,
    references: payload.references
      ? payload.references.split(/\s+/).filter(Boolean)
      : null,
    rawPayload: payload.rawPayload,
  });
}
