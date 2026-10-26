import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { requirePlatformDelegation } from "@/lib/platform/auth/require-platform-delegation";
import { listSchoolAdministrators } from "@/lib/platform/schools/admin-teaching-access";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePlatformPermission("platform.schools.manageAdminRoles");
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid school id." },
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

  try {
    const result = await listSchoolAdministrators(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("[platform/schools/[id]/admins:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load school administrators." },
      { status: 500 }
    );
  }
}
