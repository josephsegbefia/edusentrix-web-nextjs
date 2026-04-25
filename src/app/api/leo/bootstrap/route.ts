import { NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { pickLeoAppRole } from "@/lib/leo/pick-app-role";
import { resolveLeoAccess } from "@/lib/leo/access";
import { isLeoCopilotServerRuntimeEnabled } from "@/lib/leo/runtime";
import type { LeoBootstrapDTO } from "@/lib/leo/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const member = await requireSchoolMember({
      allowedRoles: ["school_admin", "bursar", "billing_owner"],
    });

    if (!isLeoCopilotServerRuntimeEnabled()) {
      return NextResponse.json(
        {
          success: false,
          error: "feature_disabled",
          message: "Leo Copilot is disabled by server configuration.",
        },
        { status: 503 }
      );
    }

    const role = pickLeoAppRole(member.roles);
    const access = await resolveLeoAccess({
      schoolId: member.schoolId,
      role,
    });

    const payload: LeoBootstrapDTO = {
      version: 1,
      role,
      schoolId: String(member.schoolId),
      access,
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo bootstrap error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Leo bootstrap" },
      { status: 500 }
    );
  }
}
