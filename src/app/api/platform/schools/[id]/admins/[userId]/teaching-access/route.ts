import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { requirePlatformDelegation } from "@/lib/platform/auth/require-platform-delegation";
import { setAdministratorTeachingAccess } from "@/lib/platform/schools/admin-teaching-access";

const bodySchema = z.object({ enabled: z.boolean() });

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const gate = await requirePlatformPermission("platform.schools.manageAdminRoles");
  if (!gate.ok) return gate.res;

  const { id, userId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { success: false, error: "Invalid school or administrator id." },
      { status: 400 }
    );
  }

  const scope = await requirePlatformDelegation({
    actor: gate.actor,
    schoolId: new mongoose.Types.ObjectId(id),
    permission: "platform.schools.manageAdminRoles",
    scope: "school_admin_role_management",
  });
  if (!scope.ok) {
    return NextResponse.json(
      { success: false, error: scope.error },
      { status: scope.status }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Request body must include a boolean enabled value." },
      { status: 400 }
    );
  }

  try {
    const result = await setAdministratorTeachingAccess({
      schoolId: id,
      userId,
      actorUserId: gate.actor.userId,
      enabled: parsed.data.enabled,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("[platform/schools/[id]/admins/[userId]/teaching-access:PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update administrator teaching access." },
      { status: 500 }
    );
  }
}
