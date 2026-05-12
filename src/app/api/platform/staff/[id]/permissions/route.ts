import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import {
  PLATFORM_PERMISSION_REGISTRY,
  validatePlatformPermissionKeys,
  type PlatformPermissionKey,
} from "@/lib/platform/permissions/registry";
import { PLATFORM_STAFF_ROLE_PRESETS } from "@/lib/platform/permissions/presets";
import { serializePlatformStaffProfile } from "@/lib/platform/staff/serialize-platform-staff";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";

const CRITICAL_CONFIRMATION = "I understand";

const UpdatePermissionsSchema = z.object({
  rolePreset: z.enum(PLATFORM_STAFF_ROLE_PRESETS),
  permissions: z.array(z.string().trim()).min(1),
  accessMode: z.enum(["all_schools", "delegated_only"]),
  reason: z.string().trim().min(8).max(1000),
  criticalConfirmation: z.string().trim().optional().default(""),
});

function canAssignPermissions(
  actorPermissions: PlatformPermissionKey[],
  requestedPermissions: PlatformPermissionKey[],
  isLegacyPlatformAdmin: boolean
) {
  if (isLegacyPlatformAdmin) return true;
  const actorPermissionSet = new Set(actorPermissions);
  return requestedPermissions.every((permission) => actorPermissionSet.has(permission));
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.staff.manageRoles");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid platform staff id." },
        { status: 400 }
      );
    }

    const parsed = UpdatePermissionsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid permission update payload.", details: parsed.error.flatten() },
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
        { success: false, error: "All-school access requires staff role management permission." },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const profile = await PlatformStaffProfile.findById(id);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Platform staff profile not found." },
        { status: 404 }
      );
    }

    const before = {
      rolePreset: profile.rolePreset,
      accessMode: profile.accessMode,
      permissions: profile.permissions || [],
    };

    profile.rolePreset = input.rolePreset;
    profile.accessMode = input.accessMode;
    profile.permissions = permissions;
    await profile.save();

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      action: "platform.staff.permissions_changed",
      entityType: "PlatformStaffProfile",
      entityId: profile._id,
      metadata: {
        targetEmail: profile.email,
        reason: input.reason,
        before,
        after: {
          rolePreset: input.rolePreset,
          accessMode: input.accessMode,
          permissions,
        },
        criticalPermissions,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializePlatformStaffProfile(profile.toObject()),
    });
  } catch (error) {
    console.error("[platform/staff/[id]/permissions:PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update platform staff permissions" },
      { status: 500 }
    );
  }
}
