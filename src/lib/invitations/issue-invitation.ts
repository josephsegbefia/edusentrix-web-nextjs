import "server-only";

import mongoose, { Types } from "mongoose";
import { Invitation } from "@/models/Invitation";
import type { InvitationRole } from "@/lib/roles";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import {
  getInvitationRedirectUrl,
  requireInvitationAcceptUrl,
  withInvitedEmail,
} from "@/lib/utils/getAppUrl";
import * as clerkInvitation from "./clerk-invitation";
import {
  invitationDeliveryCode,
  type InvitationDeliveryCode,
  type InvitationEmailStatus,
} from "./delivery-copy";
import {
  invitationDisplayRole,
  invitationTemplateKeyForRole,
} from "./templates";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type IssueInvitationInput = {
  email: string;
  role: InvitationRole;
  schoolId: string | Types.ObjectId;
  invitedBy: string | Types.ObjectId;
  recipientName?: string | null;
  schoolName?: string | null;
  redirectNext?: string | null;
  publicMetadata?: Record<string, unknown>;
  invitationMetadata?: Record<string, unknown>;
  actorRole?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  recipientUserId?: string | null;
  existingInvitationId?: string | Types.ObjectId;
};

export type IssueInvitationResult = {
  invitationId: string;
  clerkInvitationId: string | null;
  invitationStatus: "pending" | "failed";
  emailStatus: InvitationEmailStatus;
  emailMessageId?: string;
  deliveryCode: InvitationDeliveryCode;
  warning?: string;
  reusedExisting: boolean;
  resendCount: number;
};

function asObjectId(value: string | Types.ObjectId): Types.ObjectId {
  return value instanceof Types.ObjectId
    ? value
    : new Types.ObjectId(String(value));
}

function buildRedirectUrl(email: string, redirectNext?: string | null): string {
  const base = getInvitationRedirectUrl();
  const withNext = redirectNext
    ? `${base}?next=${encodeURIComponent(redirectNext)}`
    : base;
  return withInvitedEmail(withNext, email);
}

function renderInvitationEmail(input: {
  role: InvitationRole;
  schoolName: string;
  recipientName: string;
  setupLink: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.role === "school_admin") {
    return renderTemplate("SCHOOL_INVITE", {
      schoolName: input.schoolName,
      setupLink: input.setupLink,
    });
  }

  return renderTemplate("USER_INVITE", {
    name: input.recipientName,
    role: invitationDisplayRole(input.role, input.metadata),
    schoolName: input.schoolName,
    setupLink: input.setupLink,
  });
}

export async function issueInvitation(
  input: IssueInvitationInput
): Promise<IssueInvitationResult> {
  const email = input.email.toLowerCase().trim();
  if (!email) {
    throw new Error("Invitation email is required");
  }

  const schoolId = asObjectId(input.schoolId);
  const invitedBy = asObjectId(input.invitedBy);
  const templateKey = invitationTemplateKeyForRole(input.role);
  const schoolName = input.schoolName?.trim() || "your school";
  const recipientName = input.recipientName?.trim() || email;
  const redirectUrl = buildRedirectUrl(email, input.redirectNext);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  let clerkInvitationId: string | null = null;
  let setupLink: string | null = null;
  let invitationStatus: "pending" | "failed" = "pending";
  let warning: string | undefined;

  try {
    const createdClerkInvite = await clerkInvitation.clerkInvitationPort.create({
      email,
      redirectUrl,
      publicMetadata: {
        role: input.role,
        schoolId: String(schoolId),
        ...input.publicMetadata,
      },
    });
    clerkInvitationId = createdClerkInvite.id;
    setupLink = requireInvitationAcceptUrl(createdClerkInvite, email);
  } catch (error) {
    invitationStatus = "failed";
    warning = error instanceof Error ? error.message : "Failed to create Clerk invitation";
  }

  const existingFilter = input.existingInvitationId
    ? {
        _id: asObjectId(input.existingInvitationId),
        schoolId,
      }
    : {
        schoolId,
        email,
        role: input.role,
        status: "pending" as const,
      };

  const existing = await Invitation.findOne(existingFilter);
  const reusedExisting = Boolean(existing);
  const now = new Date();

  const invitation = existing
    ? await Invitation.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            clerkInvitationId: clerkInvitationId || existing.clerkInvitationId,
            status: invitationStatus,
            sentAt: now,
            lastResentAt: reusedExisting ? now : existing.lastResentAt,
            expiresAt,
            invitedBy,
            metadata: {
              ...(existing.metadata || {}),
              ...(input.invitationMetadata || {}),
            },
          },
          $inc: { resendCount: reusedExisting ? 1 : 0 },
        },
        { new: true }
      )
    : await Invitation.create({
        email,
        role: input.role,
        schoolId,
        status: invitationStatus,
        clerkInvitationId: clerkInvitationId || undefined,
        sentAt: now,
        expiresAt,
        resendCount: 0,
        invitedBy,
        metadata: input.invitationMetadata || {},
      });

  if (!invitation) {
    throw new Error("Failed to persist invitation");
  }

  if (invitationStatus === "failed" || !setupLink) {
    return {
      invitationId: String(invitation._id),
      clerkInvitationId,
      invitationStatus: "failed",
      emailStatus: "failed",
      deliveryCode: invitationDeliveryCode("failed"),
      warning: warning || "Invitation could not be completed",
      reusedExisting,
      resendCount: invitation.resendCount ?? 0,
    };
  }

  const rendered = renderInvitationEmail({
    role: input.role,
    schoolName,
    recipientName,
    setupLink,
    metadata: invitation.metadata as Record<string, unknown> | undefined,
  });

  try {
    const emailResult = await sendTrackedBrevoEmail({
      to: email,
      toName: recipientName,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      templateKey,
      schoolId: String(schoolId),
      schoolName,
      actorId: String(invitedBy),
      actorRole: input.actorRole || null,
      relatedEntityType: input.relatedEntityType || "invitation",
      relatedEntityId: input.relatedEntityId || String(invitation._id),
      recipientUserId: input.recipientUserId || null,
      recipientRole: input.role,
      enqueueOnFailure: true,
    });

    const emailStatus: InvitationEmailStatus =
      emailResult.status === "sent"
        ? "sent"
        : emailResult.status === "queued"
          ? "queued"
          : "failed";

    return {
      invitationId: String(invitation._id),
      clerkInvitationId,
      invitationStatus: "pending",
      emailStatus,
      emailMessageId: emailResult.messageId,
      deliveryCode: invitationDeliveryCode(emailStatus),
      warning:
        emailStatus === "sent"
          ? undefined
          : emailStatus === "queued"
            ? "Invitation email is queued for retry."
            : "Invitation email delivery failed.",
      reusedExisting,
      resendCount: invitation.resendCount ?? 0,
    };
  } catch (error) {
    return {
      invitationId: String(invitation._id),
      clerkInvitationId,
      invitationStatus: "pending",
      emailStatus: "failed",
      deliveryCode: invitationDeliveryCode("failed"),
      warning:
        error instanceof Error ? error.message : "Invitation email delivery failed.",
      reusedExisting,
      resendCount: invitation.resendCount ?? 0,
    };
  }
}

export function assertValidInvitationObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}
