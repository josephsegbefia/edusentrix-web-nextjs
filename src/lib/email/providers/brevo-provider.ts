/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import * as SibApiV3Sdk from "@sendinblue/client";

const {
  BREVO_API_KEY,
  BREVO_DEFAULT_FROM_EMAIL,
  BREVO_DEFAULT_FROM_NAME,
  BREVO_BILLING_FROM_EMAIL,
} = process.env;

let apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;

function getConfig() {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not set");
  return {
    apiKey: BREVO_API_KEY,
    defaultFromEmail: BREVO_DEFAULT_FROM_EMAIL || "hello@tryedusentrix.app",
    defaultFromName: BREVO_DEFAULT_FROM_NAME || "Edusentrix",
    billingFromEmail:
      BREVO_BILLING_FROM_EMAIL || "billing@tryedusentrix.app",
  };
}

function getClient(): SibApiV3Sdk.TransactionalEmailsApi {
  if (!apiInstance) {
    const { apiKey } = getConfig();
    apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    (apiInstance as any).authentications["apiKey"].apiKey = apiKey;
  }
  return apiInstance;
}

export interface BrevoSendInput {
  to: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string | null;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface BrevoSendResult {
  providerMessageId?: string;
}

/**
 * Low-level Brevo transactional send. Does not persist audit records --
 * that's the orchestration layer's job.
 */
export async function brevoSend(
  input: BrevoSendInput,
): Promise<BrevoSendResult> {
  const config = getConfig();
  const client = getClient();

  const msg = new SibApiV3Sdk.SendSmtpEmail();
  msg.subject = input.subject;
  msg.htmlContent = input.htmlContent;
  if (input.textContent) msg.textContent = input.textContent;

  msg.sender = {
    email: input.fromEmail || config.defaultFromEmail,
    name: input.fromName || config.defaultFromName,
  };
  msg.to = [
    {
      email: input.to,
      ...(input.toName ? { name: input.toName } : {}),
    },
  ];

  if (input.replyTo) {
    msg.replyTo = { email: input.replyTo };
  }

  if (input.tags?.length) {
    msg.tags = input.tags;
  }

  if (input.headers && Object.keys(input.headers).length > 0) {
    msg.headers = input.headers;
  }

  const res = await client.sendTransacEmail(msg);
  return {
    providerMessageId: (res as any)?.body?.messageId,
  };
}

/**
 * Resolve the correct sender email for a given sender family.
 */
export function resolveSenderEmail(
  senderFamily: "hello" | "billing" | "support",
): string {
  const config = getConfig();
  switch (senderFamily) {
    case "billing":
      return config.billingFromEmail;
    case "hello":
    case "support":
    default:
      return config.defaultFromEmail;
  }
}

/**
 * Build a display sender name for school-branded email.
 */
export function buildSchoolSenderName(
  schoolName: string,
  senderFamily: "hello" | "billing" | "support",
): string {
  if (senderFamily === "billing") {
    return `${schoolName} Billing via Edusentrix`;
  }
  return `${schoolName} via Edusentrix`;
}
