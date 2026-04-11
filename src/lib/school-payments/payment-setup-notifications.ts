import "server-only";

import { sendTrackedBrevoEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/utils/getAppUrl";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function getPaymentSetupNotificationRecipients(input: {
  ownerEmail?: string | null;
  delegateEmail?: string | null;
}) {
  return Array.from(
    new Set(
      [input.ownerEmail, input.delegateEmail]
        .map((value) => value?.toLowerCase().trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

export async function sendPaymentSetupNotification(input: {
  recipients: string[];
  schoolName: string;
  schoolId?: string | null;
  subject: string;
  title: string;
  message: string;
  note?: string | null;
  templateKey?: string;
}) {
  if (input.recipients.length === 0) return;

  const appUrl = getAppUrl();
  const actionUrl = `${appUrl}/sign-in?redirect_url=${encodeURIComponent(
    `${appUrl}/admin/settings/payment-setup`
  )}`;
  const safeTitle = escapeHtml(input.title);
  const safeSchoolName = escapeHtml(input.schoolName);
  const safeMessage = escapeHtml(input.message);
  const safeNote = input.note ? escapeHtml(input.note) : null;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin-bottom: 8px;">${safeTitle}</h2>
      <p style="margin-top: 0; color: #475569;">${safeSchoolName}</p>
      <p>${safeMessage}</p>
      ${
        safeNote
          ? `<div style="margin: 20px 0; padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
               <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">Review note</p>
               <p style="margin: 0;">${safeNote}</p>
             </div>`
          : ""
      }
      <a
        href="${actionUrl}"
        style="display: inline-block; margin-top: 10px; padding: 12px 18px; border-radius: 10px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600;"
      >
        Open Payment Setup
      </a>
    </div>
  `;

  const resolvedKey = input.templateKey || "PAYMENT_SETUP_REMINDER";

  await Promise.allSettled(
    input.recipients.map((recipient) =>
      sendTrackedBrevoEmail({
        to: recipient,
        subject: input.subject,
        htmlContent,
        templateKey: resolvedKey,
        schoolId: input.schoolId,
        schoolName: input.schoolName,
        relatedEntityType: "payment_setup",
      })
    )
  );
}
