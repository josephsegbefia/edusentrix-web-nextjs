import { NextResponse } from "next/server";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";

export async function GET() {
  try {
    const platformAuth = await requirePlatformUser();
    const canManageAdminRoles =
      platformAuth.ok &&
      hasPlatformPermission(platformAuth.actor, "platform.schools.manageAdminRoles");
    const active = await getActiveAssistedAccessSession();
    if (!active) {
      return NextResponse.json({
        success: true,
        data: { active: false, canManageAdminRoles },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        active: true,
        sessionId: active.sessionId,
        schoolId: String(active.schoolId),
        schoolName: active.schoolName,
        actorEmail: active.actorEmail,
        actorName: active.actorName,
        reason: active.reason,
        startedAt: active.startedAt.toISOString(),
        expiresAt: active.expiresAt.toISOString(),
        canManageAdminRoles,
      },
    });
  } catch (error) {
    console.error("Failed to load assisted access session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load assisted access session." },
      { status: 500 }
    );
  }
}
