import "server-only";
import {
  renderTemplate,
  type TemplateKey,
  type TemplatePayload,
} from "./templates";
import { EmailMessage } from "@/models/EmailMessage";
import { lookupTemplateRegistry } from "./registry";
import { renderGenericBrandedEmail, stripHtml } from "./branded-template";
import { resendSend, resolveDefaultSender } from "./providers/resend-provider";

const { EMAIL_AUDIT_ENABLED } = process.env;

const auditEnabled = EMAIL_AUDIT_ENABLED !== "false";

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
  const { fromEmail, fromName } = resolveDefaultSender();
  const { subject, htmlContent, textContent } = renderTemplate(template, data);

  const recipientEmail = typeof to === "string" ? to : to[0]?.email || "";

  try {
    const recipients = typeof to === "string" ? [{ email: to }] : to;
    const results = await Promise.all(recipients.map((recipient) => resendSend({
      to: recipient.email,
      toName: recipient.name,
      subject,
      htmlContent,
      textContent,
      fromEmail,
      fromName,
    })));
    const providerMessageId = results[0]?.providerMessageId;

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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[Resend] send email error:", detail);

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
        console.error("[Resend] Failed to persist audit record:", e),
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
  const { fromEmail, fromName } = resolveDefaultSender();
  const brandedHtmlContent = renderGenericBrandedEmail({
    subject,
    htmlContent,
  });
  const textContent = stripHtml(brandedHtmlContent);

  try {
    const result = await resendSend({
      to,
      subject,
      htmlContent: brandedHtmlContent,
      textContent,
      fromEmail: senderEmail || fromEmail,
      fromName: senderName || fromName,
    });
    const providerMessageId = result.providerMessageId;

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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[Resend] send email error:", detail);

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
        console.error("[Resend] Failed to persist audit record:", e),
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
    provider: "resend",
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
