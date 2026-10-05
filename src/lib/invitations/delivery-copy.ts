export type InvitationEmailStatus = "sent" | "queued" | "failed";

export type InvitationDeliveryCode =
  | "INVITATION_CREATED_EMAIL_SENT"
  | "INVITATION_CREATED_EMAIL_QUEUED"
  | "INVITATION_CREATED_EMAIL_FAILED";

export function invitationDeliveryCode(
  emailStatus: InvitationEmailStatus
): InvitationDeliveryCode {
  if (emailStatus === "sent") return "INVITATION_CREATED_EMAIL_SENT";
  if (emailStatus === "queued") return "INVITATION_CREATED_EMAIL_QUEUED";
  return "INVITATION_CREATED_EMAIL_FAILED";
}

export function invitationEmailUserMessage(
  emailStatus: InvitationEmailStatus,
  email?: string | null
): string {
  const recipient = email?.trim() || "the recipient";
  if (emailStatus === "sent") {
    return `Invite email sent to ${recipient}.`;
  }
  if (emailStatus === "queued") {
    return `Invitation created. Email delivery is queued for retry to ${recipient}.`;
  }
  return `Invitation created but email delivery failed for ${recipient}.`;
}
