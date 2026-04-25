/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import * as SibApiV3Sdk from "@sendinblue/client";
import {
  renderTemplate,
  type TemplateKey,
  type TemplatePayload,
} from "./templates";
import { EmailMessage } from "@/models/EmailMessage";
import { lookupTemplateRegistry } from "./registry";
import { renderGenericBrandedEmail, stripHtml } from "./branded-template";

const { BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, EMAIL_AUDIT_ENABLED } =
  process.env;

const auditEnabled = EMAIL_AUDIT_ENABLED !== "false";

let apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;

function getBrevoConfig() {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not set");
  if (!BREVO_FROM_EMAIL) throw new Error("BREVO_FROM_EMAIL is not set");
  if (!BREVO_FROM_NAME) throw new Error("BREVO_FROM_NAME is not set");
  return {
    apiKey: BREVO_API_KEY,
    fromEmail: BREVO_FROM_EMAIL,
    fromName: BREVO_FROM_NAME,
  };
}

function getBrevoClient() {
  if (!apiInstance) {
    const { apiKey } = getBrevoConfig();
    apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    (apiInstance as any).authentications["apiKey"].apiKey = apiKey;
  }
  return apiInstance;
}

export type Recipient = { email: string; name?: string };

/**
 * Template-based email with audit persistence.
 *
 * COMPATIBILITY: This function preserves its original call signature.
 * Existing call sites do not need to change. The new orchestration layer
 * persists an EmailMessage audit record alongside the send.
 */
export async function sendEmail<K extends TemplateKey>(
  to: string | Recipient[],
  template: K,
  data: TemplatePayload[K]
): Promise<{ messageId?: string }> {
  const { fromEmail, fromName } = getBrevoConfig();
  const client = getBrevoClient();
  const { subject, htmlContent, textContent } = renderTemplate(template, data);

  const msg = new SibApiV3Sdk.SendSmtpEmail();
  msg.subject = subject;
  msg.htmlContent = htmlContent;
  if (textContent) msg.textContent = textContent;

  msg.sender = { email: fromEmail, name: fromName };
  msg.to = typeof to === "string" ? [{ email: to }] : to;

  const recipientEmail = typeof to === "string" ? to : to[0]?.email || "";

  try {
    const res = await client.sendTransacEmail(msg);
    const providerMessageId = (res as any)?.body?.messageId;

    if (auditEnabled) {
      await persistAuditRecord({
        templateKey: template,
        to: recipientEmail,
        subject,
        htmlContent,
        textContent,
        fromEmail,
        fromName,
        status: "sent",
        providerMessageId,
      });
    }

    return { messageId: providerMessageId };
  } catch (error: any) {
    const detail = error?.response?.body
      ? JSON.stringify(error.response.body)
      : error?.message ?? String(error);
    console.error("[Brevo] sendTransacEmail error:", detail);

    if (auditEnabled) {
      await persistAuditRecord({
        templateKey: template,
        to: recipientEmail,
        subject,
        htmlContent,
        textContent,
        fromEmail,
        fromName,
        status: "failed",
        failureReason: detail,
      }).catch((e) =>
        console.error("[Brevo] Failed to persist audit record:", e),
      );
    }

    throw new Error("Failed to send email");
  }
}

/**
 * Raw email sender with audit persistence.
 *
 * COMPATIBILITY: Preserves original call signature.
 */
export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  senderEmail?: string;
  senderName?: string;
}) {
  const { to, subject, htmlContent, senderEmail, senderName } = opts;
  const { fromEmail, fromName } = getBrevoConfig();
  const client = getBrevoClient();
  const brandedHtmlContent = renderGenericBrandedEmail({
    subject,
    htmlContent,
  });
  const textContent = stripHtml(brandedHtmlContent);

  const msg = new SibApiV3Sdk.SendSmtpEmail();
  msg.subject = subject;
  msg.htmlContent = brandedHtmlContent;
  msg.textContent = textContent;

  msg.sender = {
    email: senderEmail || fromEmail,
    name: senderName || fromName,
  };
  msg.to = [{ email: to }];

  try {
    const res = await client.sendTransacEmail(msg);
    const providerMessageId = (res as any)?.body?.messageId;

    if (auditEnabled) {
      await persistAuditRecord({
        templateKey: null,
        to,
        subject,
        htmlContent: brandedHtmlContent,
        textContent,
        fromEmail: senderEmail || fromEmail,
        fromName: senderName || fromName,
        status: "sent",
        providerMessageId,
      });
    }
  } catch (error: any) {
    const detail = error?.response?.body
      ? JSON.stringify(error.response.body)
      : error?.message ?? String(error);
    console.error("[Brevo] sendTransacEmail error:", detail);

    if (auditEnabled) {
      await persistAuditRecord({
        templateKey: null,
        to,
        subject,
        htmlContent: brandedHtmlContent,
        textContent,
        fromEmail: senderEmail || fromEmail,
        fromName: senderName || fromName,
        status: "failed",
        failureReason: detail,
      }).catch((e) =>
        console.error("[Brevo] Failed to persist audit record:", e),
      );
    }

    throw new Error("Failed to send email");
  }
}

async function persistAuditRecord(opts: {
  templateKey: string | null;
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromEmail: string;
  fromName: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  failureReason?: string;
}) {
  const registry = opts.templateKey
    ? lookupTemplateRegistry(opts.templateKey)
    : null;

  await EmailMessage.create({
    provider: "brevo",
    direction: "outbound",
    mailboxScope: registry?.mailboxScope || "platform",
    mailboxKey: registry
      ? `platform_${registry.senderFamily}`
      : "platform_support",
    from: opts.fromEmail,
    fromName: opts.fromName,
    to: opts.to,
    subject: opts.subject,
    htmlBody: opts.htmlContent,
    textBody: opts.textContent || null,
    status: opts.status,
    messageClass: registry?.messageClass || "system",
    trafficClass: registry?.trafficClass || "transactional",
    priority: registry?.priority || "normal",
    sensitivity: registry?.sensitivity || "low",
    secureContentMode: registry?.secureContentMode || "none",
    templateKey: opts.templateKey,
    providerMessageId: opts.providerMessageId || null,
    failureReason: opts.failureReason || null,
    sentAt: opts.status === "sent" ? new Date() : null,
  });
}
