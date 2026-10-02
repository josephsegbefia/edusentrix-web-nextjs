import "server-only";

import { processInboundEmail } from "./process-inbound-email";

const RESEND_API_URL = "https://api.resend.com";

export interface ResendInboundWebhookData {
  email_id: string;
  from: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  message_id?: string | null;
}

type ResendReceivedEmail = {
  id?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  message_id?: string | null;
  headers?:
    | Record<string, string>
    | Array<{ name?: string; value?: string }>
    | null;
};

function parseSender(
  raw: string,
): { email: string; name?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/<([^>]+)>/);
  if (match?.[1]) {
    const name = trimmed
      .slice(0, trimmed.indexOf("<"))
      .trim()
      .replace(/^"|"$/g, "");

    return {
      email: match[1].trim(),
      name: name || undefined,
    };
  }

  if (trimmed.includes("@")) {
    return { email: trimmed };
  }

  return null;
}

function headerValue(
  headers: ResendReceivedEmail["headers"],
  wantedName: string,
): string | null {
  if (!headers) return null;

  const wanted = wantedName.toLowerCase();

  if (Array.isArray(headers)) {
    const found = headers.find(
      (header) => header.name?.toLowerCase() === wanted,
    );
    return found?.value?.trim() || null;
  }

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === wanted) {
      return value?.trim() || null;
    }
  }

  return null;
}

function dedupeRecipients(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value!.trim());
  }

  return result;
}

async function retrieveReceivedEmail(
  emailId: string,
): Promise<ResendReceivedEmail> {
  const apiKey = process.env.RESEND_INBOUND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_INBOUND_API_KEY is not configured");
  }

  const response = await fetch(
    `${RESEND_API_URL}/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "User-Agent": "EduSentrix/1.0",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to retrieve Resend inbound email (${response.status})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  return (await response.json()) as ResendReceivedEmail;
}

export async function receiveResendInbound(
  data: ResendInboundWebhookData,
  rawPayload: Record<string, unknown>,
) {
  if (!data.email_id) {
    throw new Error("Resend inbound event is missing email_id");
  }

  const email = await retrieveReceivedEmail(data.email_id);

  const sender = parseSender(data.from || email.from || "");
  if (!sender) {
    throw new Error("Resend inbound email has no valid sender");
  }

  const recipients = dedupeRecipients([
    ...(data.to || email.to || []),
    ...(data.cc || email.cc || []),
    ...(data.bcc || email.bcc || []),
  ]);

  if (recipients.length === 0) {
    throw new Error("Resend inbound email has no recipients");
  }

  const inReplyTo = headerValue(email.headers, "in-reply-to");
  const referencesRaw = headerValue(email.headers, "references");

  return processInboundEmail({
    provider: "resend",
    sender,
    recipients,
    subject: data.subject || email.subject || "(No subject)",
    htmlBody: email.html || null,
    textBody: email.text || null,
    messageId: data.message_id || email.message_id || data.email_id,
    inReplyTo,
    references: referencesRaw
      ? referencesRaw.split(/\s+/).filter(Boolean)
      : null,
    rawPayload,
  });
}
