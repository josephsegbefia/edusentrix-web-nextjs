/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import * as SibApiV3Sdk from "@sendinblue/client";
import {
  renderTemplate,
  type TemplateKey,
  type TemplatePayload,
} from "./templates";

const { BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME } = process.env;

if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not set");
if (!BREVO_FROM_EMAIL) throw new Error("BREVO_FROM_EMAIL is not set");
if (!BREVO_FROM_NAME) throw new Error("BREVO_FROM_NAME is not set");

/** Singleton API instance configured like your example */
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
// Match example's pattern (SDK expects 'apiKey' – not 'api-key')
(apiInstance as any).authentications["apiKey"].apiKey = BREVO_API_KEY;

export type Recipient = { email: string; name?: string };

/** Template-based email (recommended for app usage) */
export async function sendEmail<K extends TemplateKey>(
  to: string | Recipient[],
  template: K,
  data: TemplatePayload[K]
): Promise<{ messageId?: string }> {
  const { subject, htmlContent, textContent } = renderTemplate(template, data);

  const msg = new SibApiV3Sdk.SendSmtpEmail();
  msg.subject = subject;
  msg.htmlContent = htmlContent;
  if (textContent) msg.textContent = textContent;

  msg.sender = { email: BREVO_FROM_EMAIL!, name: BREVO_FROM_NAME! };
  msg.to = typeof to === "string" ? [{ email: to }] : to;

  try {
    const res = await apiInstance.sendTransacEmail(msg);
    return { messageId: (res as any)?.body?.messageId };
  } catch (error: any) {
    const detail = error?.response?.body
      ? JSON.stringify(error.response.body)
      : error?.message ?? String(error);
    console.error("[Brevo] sendTransacEmail error:", detail);
    throw new Error("Failed to send email");
  }
}

/** Raw email sender matching your example signature (handy for quick tests) */
export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  senderEmail?: string;
  senderName?: string;
}) {
  const { to, subject, htmlContent, senderEmail, senderName } = opts;

  const msg = new SibApiV3Sdk.SendSmtpEmail();
  msg.subject = subject;
  msg.htmlContent = htmlContent;

  msg.sender = {
    email: senderEmail || BREVO_FROM_EMAIL!,
    name: senderName || BREVO_FROM_NAME!,
  };
  msg.to = [{ email: to }];

  try {
    await apiInstance.sendTransacEmail(msg);
  } catch (error: any) {
    const detail = error?.response?.body
      ? JSON.stringify(error.response.body)
      : error?.message ?? String(error);
    console.error("[Brevo] sendTransacEmail error:", detail);
    throw new Error("Failed to send email");
  }
}
