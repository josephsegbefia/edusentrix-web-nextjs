import "server-only";
import nodemailer from "nodemailer";

const {
  SPACEMAIL_SMTP_HOST,
  SPACEMAIL_SMTP_PORT,
  SPACEMAIL_SMTP_USER,
  SPACEMAIL_SMTP_PASSWORD,
} = process.env;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!SPACEMAIL_SMTP_HOST || !SPACEMAIL_SMTP_USER || !SPACEMAIL_SMTP_PASSWORD) {
    throw new Error("Spacemail SMTP credentials not configured");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SPACEMAIL_SMTP_HOST,
      port: parseInt(SPACEMAIL_SMTP_PORT || "465", 10),
      secure: true,
      auth: {
        user: SPACEMAIL_SMTP_USER,
        pass: SPACEMAIL_SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

export interface SpacemailSendInput {
  to: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  headers?: Record<string, string>;
}

export interface SpacemailSendResult {
  providerMessageId?: string;
}

/**
 * Send a manual/human email via Spacemail SMTP.
 * Used for one-to-one support and operator email.
 */
export async function spacemailSend(
  input: SpacemailSendInput,
): Promise<SpacemailSendResult> {
  const transport = getTransporter();

  const from = input.fromName
    ? `"${input.fromName}" <${input.fromEmail || SPACEMAIL_SMTP_USER}>`
    : input.fromEmail || SPACEMAIL_SMTP_USER!;

  const to = input.toName ? `"${input.toName}" <${input.to}>` : input.to;

  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to,
    subject: input.subject,
    html: input.htmlContent,
    ...(input.textContent ? { text: input.textContent } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    headers: {
      ...(input.headers || {}),
      ...(input.inReplyTo ? { "In-Reply-To": input.inReplyTo } : {}),
      ...(input.references?.length
        ? { References: input.references.join(" ") }
        : {}),
    },
  };

  const info = await transport.sendMail(mailOptions);
  return {
    providerMessageId: info.messageId,
  };
}
