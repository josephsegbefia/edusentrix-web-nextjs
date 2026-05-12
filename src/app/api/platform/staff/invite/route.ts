import { NextRequest, NextResponse } from "next/server";
import type { Invitation } from "@clerk/backend";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { sendRawEmail } from "@/lib/email/brevo";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import {
  PLATFORM_PERMISSION_REGISTRY,
  validatePlatformPermissionKeys,
  type PlatformPermissionKey,
} from "@/lib/platform/permissions/registry";
import {
  PLATFORM_ROLE_PRESETS,
  PLATFORM_STAFF_ROLE_PRESETS,
} from "@/lib/platform/permissions/presets";
import { getInvitationRedirectUrl } from "@/lib/utils/getAppUrl";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import { User } from "@/models/User";

export const runtime = "nodejs";

const CRITICAL_CONFIRMATION = "I understand";

const InviteStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  email: z.string().email().transform((email) => email.toLowerCase().trim()),
  phone: z.string().trim().max(30).optional().default(""),
  jobTitle: z.string().trim().min(2).max(120),
  rolePreset: z.enum(PLATFORM_STAFF_ROLE_PRESETS),
  permissions: z.array(z.string().trim()).min(1),
  accessMode: z.enum(["all_schools", "delegated_only"]),
  criticalConfirmation: z.string().trim().optional().default(""),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function canAssignPermissions(
  actorPermissions: PlatformPermissionKey[],
  requestedPermissions: PlatformPermissionKey[],
  isLegacyPlatformAdmin: boolean
) {
  if (isLegacyPlatformAdmin) return true;
  const actorPermissionSet = new Set(actorPermissions);
  return requestedPermissions.every((permission) => actorPermissionSet.has(permission));
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.staff.invite");
    if (!gate.ok) return gate.res;

    const parsed = InviteStaffSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid staff invitation payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const validation = validatePlatformPermissionKeys(input.permissions);
    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more selected permissions are invalid.",
          invalidPermissions: validation.invalid,
        },
        { status: 400 }
      );
    }

    const permissions = Array.from(new Set(validation.permissions));
    const criticalPermissions = permissions.filter(
      (permission) => PLATFORM_PERMISSION_REGISTRY[permission].riskLevel === "critical"
    );

    if (criticalPermissions.length > 0 && input.criticalConfirmation !== CRITICAL_CONFIRMATION) {
      return NextResponse.json(
        {
          success: false,
          error: `Critical permissions require the confirmation phrase: ${CRITICAL_CONFIRMATION}`,
        },
        { status: 400 }
      );
    }

    if (
      !canAssignPermissions(
        gate.actor.permissions,
        permissions,
        gate.actor.isLegacyPlatformAdmin
      )
    ) {
      return NextResponse.json(
        { success: false, error: "You cannot assign permissions you do not have." },
        { status: 403 }
      );
    }

    if (
      input.accessMode === "all_schools" &&
      !hasPlatformPermission(gate.actor, "platform.staff.manageRoles") &&
      !gate.actor.isLegacyPlatformAdmin
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "All-school access requires staff role management permission.",
        },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const existingProfile = await PlatformStaffProfile.findOne({ email: input.email })
      .select("_id status")
      .lean<{ _id: unknown; status: string } | null>();

    if (existingProfile) {
      return NextResponse.json(
        {
          success: false,
          error: `A platform staff profile already exists for this email (${existingProfile.status}).`,
        },
        { status: 409 }
      );
    }

    const redirectUrl = getInvitationRedirectUrl();
    const clerk = await clerkClient();
    const invitation = (await clerk.invitations.createInvitation({
      emailAddress: input.email,
      redirectUrl,
      notify: false,
      publicMetadata: {
        role: "platform_staff",
        platformRolePreset: input.rolePreset,
      },
      ignoreExisting: true,
    })) as Invitation;

    const acceptUrl = invitation.url?.trim();
    if (!acceptUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Invitation was created but no acceptance link was returned.",
        },
        { status: 502 }
      );
    }

    const nameParts = input.fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || input.fullName;
    const lastName = nameParts.slice(1).join(" ");
    const user =
      (await User.findOne({ email: input.email, schoolId: null })) ||
      (await User.create({
        email: input.email,
        name: input.fullName,
        firstName,
        lastName,
        phone: input.phone || undefined,
        pendingOnboarding: true,
      }));

    const profile = await PlatformStaffProfile.create({
      userId: user._id,
      clerkUserId: user.clerkUserId ?? null,
      email: input.email,
      fullName: input.fullName,
      jobTitle: input.jobTitle,
      rolePreset: input.rolePreset,
      permissions,
      status: "invited",
      accessMode: input.accessMode,
      invitedByUserId: gate.actor.userId,
      invitedAt: new Date(),
    });

    let emailDeliveryWarning: string | null = null;
    try {
      await sendRawEmail({
        to: input.email,
        subject: "EduSentrix platform staff invitation",
        htmlContent: `
          <p>Hello ${escapeHtml(input.fullName)},</p>
          <p>You have been invited to join the EduSentrix Platform Operations Console as <strong>${escapeHtml(input.jobTitle)}</strong>.</p>
          <p>Your role preset is <strong>${escapeHtml(PLATFORM_ROLE_PRESETS[input.rolePreset].label)}</strong> with <strong>${permissions.length}</strong> platform permission${permissions.length === 1 ? "" : "s"}.</p>
          <p><a href="${acceptUrl}">Accept invitation and continue</a></p>
          <p style="font-size:12px;color:#555;word-break:break-all;">If the button does not work, copy this URL: ${acceptUrl}</p>
        `,
      });
    } catch (emailError) {
      console.error("[platform/staff/invite:email]", emailError);
      emailDeliveryWarning =
        emailError instanceof Error ? emailError.message : "Failed to send invitation email";
    }

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      action: "platform.staff.invited",
      entityType: "PlatformStaffProfile",
      entityId: profile._id,
      metadata: {
        email: input.email,
        rolePreset: input.rolePreset,
        accessMode: input.accessMode,
        permissionCount: permissions.length,
        criticalPermissions,
        clerkInvitationId: invitation.id,
        emailDeliveryWarning,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(profile._id),
        userId: String(user._id),
        email: input.email,
        status: "invited",
        permissionCount: permissions.length,
        clerkInvitationId: invitation.id,
        emailDeliveryWarning,
      },
    });
  } catch (error) {
    console.error("[platform/staff/invite:POST]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to invite platform staff",
      },
      { status: 500 }
    );
  }
}
