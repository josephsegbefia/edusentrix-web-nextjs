import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";

export type EmailSenderFamily = "hello" | "billing" | "support";

export type ResendSendInput = {
  to: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  attachments?: Array<{ name: string; contentBase64?: string; url?: string }>;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string | null;
  tags?: string[];
  idempotencyKey?: string;
};

export type ResendSendResult = { providerMessageId?: string };

function getSenderConfig() {
  return {
    defaultFromEmail:
      process.env.RESEND_DEFAULT_FROM_EMAIL?.trim() || "hello@tryedusentrix.app",
    defaultFromName:
      process.env.RESEND_DEFAULT_FROM_NAME?.trim() || "EduSentrix",
    billingFromEmail:
      process.env.RESEND_BILLING_FROM_EMAIL?.trim() || "billing@tryedusentrix.app",
    supportFromEmail:
      process.env.RESEND_SUPPORT_FROM_EMAIL?.trim() || "support@tryedusentrix.app",
  };
}

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return { apiKey, ...getSenderConfig() };
}

export function resolveSenderEmail(senderFamily: EmailSenderFamily): string {
  const config = getSenderConfig();
  if (senderFamily === "billing") return config.billingFromEmail;
  if (senderFamily === "support") return config.supportFromEmail;
  return config.defaultFromEmail;
}

export function resolveDefaultSender() {
  const config = getSenderConfig();
  return { fromEmail: config.defaultFromEmail, fromName: config.defaultFromName };
}

export function buildSchoolSenderName(
  schoolName: string,
  senderFamily: EmailSenderFamily,
): string {
  return senderFamily === "billing"
    ? `${schoolName} Billing via EduSentrix`
    : `${schoolName} via EduSentrix`;
}

export async function resendSend(input: ResendSendInput): Promise<ResendSendResult> {
  const config = getConfig();
  const payload = {
    from: `${input.fromName || config.defaultFromName} <${input.fromEmail || config.defaultFromEmail}>`,
    to: input.toName ? [`${input.toName} <${input.to}>`] : [input.to],
    subject: input.subject,
    html: input.htmlContent,
    ...(input.textContent ? { text: input.textContent } : {}),
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    ...(input.tags?.length ? { tags: input.tags.map((value) => ({ name: "category", value })) } : {}),
    ...(input.attachments?.length
      ? {
          attachments: input.attachments.map((attachment) => ({
            filename: attachment.name,
            ...(attachment.contentBase64 ? { content: attachment.contentBase64 } : {}),
            ...(attachment.url ? { path: attachment.url } : {}),
          })),
        }
      : {}),
  };
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;
  if (!response.ok) {
    throw new Error(body?.message || body?.name || `Resend email request failed (${response.status})`);
  }
  return { providerMessageId: body?.id };
}
