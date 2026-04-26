// src/lib/admissions/applicant-notification-emails.ts
// Transactional emails to guardians during the admissions pipeline (non-decision).

import { sendTrackedBrevoEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { formatAdmissionInterviewRange } from "@/lib/admissions/interview-display";
import type { AdmissionApplicationStatus } from "./types";

const STATUS_LABEL: Record<AdmissionApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  interview_scheduled: "Interview scheduled",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function guardianName(g: { firstName?: string; lastName?: string }) {
  return `${g.firstName ?? ""} ${g.lastName ?? ""}`.trim() || "Guardian";
}

type ActorContext = {
  schoolId: string;
  schoolName: string;
  actorId?: string | null;
  actorRole?: "school_admin" | "admissions_officer" | null;
};

export async function sendAdmissionApplicationReceivedEmail(args: {
  applicationId: string;
  referenceCode: string;
  guardian: { firstName: string; lastName: string; email: string };
  trackerToken: string;
  ctx: ActorContext;
  /** System send on submit — no actor */
  systemOrigin?: boolean;
}): Promise<void> {
  const appUrl = getAppUrl();
  const trackerUrl = `${appUrl}/apply/track/${args.trackerToken}`;
  const name = guardianName(args.guardian);
  const subject = `${args.ctx.schoolName} — We received your application (${args.referenceCode})`;
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>Thank you for applying to <strong>${args.ctx.schoolName}</strong>. We have received your application
    <strong>${args.referenceCode}</strong>.</p>
    <p>You can track status and complete any next steps using your private tracker link:</p>
    <p><a href="${trackerUrl}">${trackerUrl}</a></p>
    <p>Please keep this link safe — it is how we will guide you through the rest of the process.</p>
    <p>With kind regards,<br/>${args.ctx.schoolName} Admissions</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "ADMISSIONS_APPLICATION_RECEIVED",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.systemOrigin ? undefined : args.ctx.actorId ?? undefined,
    actorRole: args.systemOrigin ? undefined : args.ctx.actorRole ?? undefined,
    relatedEntityType: "admission_application",
    relatedEntityId: args.applicationId,
  });
}

export async function sendAdmissionStatusUpdateEmail(args: {
  applicationId: string;
  referenceCode: string;
  guardian: { firstName: string; lastName: string; email: string };
  trackerToken: string;
  fromStatus: AdmissionApplicationStatus;
  toStatus: AdmissionApplicationStatus;
  interviewAt?: Date | null;
  interviewEndsAt?: Date | null;
  ctx: ActorContext;
}): Promise<void> {
  const appUrl = getAppUrl();
  const trackerUrl = `${appUrl}/apply/track/${args.trackerToken}`;
  const name = guardianName(args.guardian);
  const fromL = STATUS_LABEL[args.fromStatus];
  const toL = STATUS_LABEL[args.toStatus];
  const interviewLine =
    args.toStatus === "interview_scheduled" && args.interviewAt
      ? `<p><strong>Interview:</strong> ${formatAdmissionInterviewRange(new Date(args.interviewAt), args.interviewEndsAt ?? null)}</p>`
      : "";
  const subject = `${args.ctx.schoolName} — Application update (${args.referenceCode})`;
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>Your application <strong>${args.referenceCode}</strong> at <strong>${args.ctx.schoolName}</strong>
    has moved to a new stage.</p>
    <p><strong>Previous status:</strong> ${fromL}<br/>
    <strong>Current status:</strong> ${toL}</p>
    ${interviewLine}
    <p>View details and any actions required on your tracker:</p>
    <p><a href="${trackerUrl}">${trackerUrl}</a></p>
    <p>With kind regards,<br/>${args.ctx.schoolName} Admissions</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "ADMISSIONS_STATUS_UPDATE",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.ctx.actorId ?? undefined,
    actorRole: args.ctx.actorRole ?? undefined,
    relatedEntityType: "admission_application",
    relatedEntityId: args.applicationId,
  });
}

export async function sendAdmissionPipelineReminderEmail(args: {
  applicationId: string;
  referenceCode: string;
  guardian: { firstName: string; lastName: string; email: string };
  trackerToken: string;
  currentStatus: AdmissionApplicationStatus;
  interviewAt?: Date | null;
  interviewEndsAt?: Date | null;
  ctx: ActorContext;
}): Promise<void> {
  const appUrl = getAppUrl();
  const trackerUrl = `${appUrl}/apply/track/${args.trackerToken}`;
  const name = guardianName(args.guardian);
  const statusLine = STATUS_LABEL[args.currentStatus];
  const interviewLine =
    args.interviewAt != null
      ? `<p><strong>Interview:</strong> ${formatAdmissionInterviewRange(new Date(args.interviewAt), args.interviewEndsAt ?? null)}</p>`
      : "";
  const subject = `${args.ctx.schoolName} — Application reminder (${args.referenceCode})`;
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>This is a friendly reminder about application <strong>${args.referenceCode}</strong> at
    <strong>${args.ctx.schoolName}</strong>.</p>
    <p><strong>Current status:</strong> ${statusLine}</p>
    ${interviewLine}
    <p>Your secure tracker page has the latest details and any actions you may need to take:</p>
    <p><a href="${trackerUrl}">${trackerUrl}</a></p>
    <p>With kind regards,<br/>${args.ctx.schoolName} Admissions</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "ADMISSIONS_STATUS_UPDATE",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.ctx.actorId ?? undefined,
    actorRole: args.ctx.actorRole ?? undefined,
    relatedEntityType: "admission_application",
    relatedEntityId: args.applicationId,
  });
}

export async function sendAdmissionInterviewScheduledEmail(args: {
  applicationId: string;
  referenceCode: string;
  guardian: { firstName: string; lastName: string; email: string };
  trackerToken: string;
  interviewAt: Date;
  interviewEndsAt?: Date | null;
  ctx: ActorContext;
}): Promise<void> {
  const appUrl = getAppUrl();
  const trackerUrl = `${appUrl}/apply/track/${args.trackerToken}`;
  const name = guardianName(args.guardian);
  const when = formatAdmissionInterviewRange(
    new Date(args.interviewAt),
    args.interviewEndsAt ?? null
  );
  const subject = `${args.ctx.schoolName} — Interview scheduled (${args.referenceCode})`;
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>Your admissions interview for application <strong>${args.referenceCode}</strong> at
    <strong>${args.ctx.schoolName}</strong> is scheduled for:</p>
    <p><strong>${when}</strong></p>
    <p>If you need to reschedule, please reply to this email or contact the school as soon as possible.</p>
    <p>Your tracker link (status and documents):</p>
    <p><a href="${trackerUrl}">${trackerUrl}</a></p>
    <p>With kind regards,<br/>${args.ctx.schoolName} Admissions</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "ADMISSIONS_INTERVIEW_SCHEDULED",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.ctx.actorId ?? undefined,
    actorRole: args.ctx.actorRole ?? undefined,
    relatedEntityType: "admission_application",
    relatedEntityId: args.applicationId,
  });
}

export async function sendAdmissionDocumentRequestEmail(args: {
  applicationId: string;
  referenceCode: string;
  guardian: { firstName: string; lastName: string; email: string };
  documentLabel: string;
  message?: string | null;
  uploadUrl: string;
  ctx: ActorContext;
}): Promise<void> {
  const name = guardianName(args.guardian);
  const subject = `${args.ctx.schoolName} — Document requested (${args.referenceCode})`;
  const note = args.message
    ? `<p><strong>Message from admissions:</strong><br/>${args.message.replace(/\n/g, "<br/>")}</p>`
    : "";
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>We need an additional document for application <strong>${args.referenceCode}</strong>
    at <strong>${args.ctx.schoolName}</strong>.</p>
    <p><strong>Document:</strong> ${args.documentLabel}</p>
    ${note}
    <p>Please upload the file securely using this link (you do not need to log in):</p>
    <p><a href="${args.uploadUrl}">${args.uploadUrl}</a></p>
    <p>With kind regards,<br/>${args.ctx.schoolName} Admissions</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "ADMISSIONS_DOCUMENT_REQUEST",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.ctx.actorId ?? undefined,
    actorRole: args.ctx.actorRole ?? undefined,
    relatedEntityType: "admission_application",
    relatedEntityId: args.applicationId,
  });
}

export async function sendAdmissionFeePaymentLinkEmail(args: {
  applicationId: string;
  referenceCode: string;
  guardian: { firstName: string; lastName: string; email: string };
  trackerToken: string;
  ctx: ActorContext;
}): Promise<void> {
  const appUrl = getAppUrl();
  const trackerUrl = `${appUrl}/apply/track/${args.trackerToken}?focus=fee`;
  const name = guardianName(args.guardian);
  const subject = `${args.ctx.schoolName} — Application fee (${args.referenceCode})`;
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>An application fee payment is required for <strong>${args.referenceCode}</strong> at
    <strong>${args.ctx.schoolName}</strong>.</p>
    <p>Open your secure tracker page to review instructions and pay online (if enabled for your cycle):</p>
    <p><a href="${trackerUrl}">${trackerUrl}</a></p>
    <p>If you already paid, you can ignore this message — the tracker will update once payment is confirmed.</p>
    <p>With kind regards,<br/>${args.ctx.schoolName} Admissions</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "ADMISSIONS_FEE_PAYMENT_LINK",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.ctx.actorId ?? undefined,
    actorRole: args.ctx.actorRole ?? undefined,
    relatedEntityType: "admission_application",
    relatedEntityId: args.applicationId,
  });
}
