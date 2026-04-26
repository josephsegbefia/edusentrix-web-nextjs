import { sendTrackedBrevoEmail } from "@/lib/email";

type GuardianRecipient = {
  firstName: string;
  lastName: string;
  email: string;
};

export async function sendStudentParentDocumentRequestEmail(args: {
  studentId: string;
  studentName: string;
  guardian: GuardianRecipient;
  documentLabel: string;
  message?: string | null;
  uploadUrl: string;
  ctx: {
    schoolId: string;
    schoolName: string;
    actorId?: string | null;
    actorRole?: "school_admin" | null;
  };
}): Promise<void> {
  const name =
    `${args.guardian.firstName} ${args.guardian.lastName}`.trim() || "Parent";
  const subject = `${args.ctx.schoolName} — Document requested for ${args.studentName}`;
  const note = args.message
    ? `<p><strong>Message from the school:</strong><br/>${String(args.message).replace(/\n/g, "<br/>")}</p>`
    : "";
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>We need a document for <strong>${args.studentName}</strong> at <strong>${args.ctx.schoolName}</strong>.</p>
    <p><strong>Document:</strong> ${args.documentLabel}</p>
    ${note}
    <p>Please upload the file securely using this link (you do not need to log in):</p>
    <p><a href="${args.uploadUrl}">${args.uploadUrl}</a></p>
    <p>For security, please do not forward this link.</p>
    <p>Kind regards,<br/>${args.ctx.schoolName}</p>
  `;

  await sendTrackedBrevoEmail({
    to: args.guardian.email,
    toName: name,
    subject,
    htmlContent,
    templateKey: "STUDENT_PARENT_DOCUMENT_REQUEST",
    schoolId: args.ctx.schoolId,
    schoolName: args.ctx.schoolName,
    actorId: args.ctx.actorId ?? undefined,
    actorRole: args.ctx.actorRole ?? undefined,
    relatedEntityType: "student",
    relatedEntityId: args.studentId,
  });
}
