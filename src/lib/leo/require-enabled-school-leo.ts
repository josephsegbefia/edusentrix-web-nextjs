import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { pickLeoAppRole } from "@/lib/leo/pick-app-role";
import { resolveLeoAccess } from "@/lib/leo/access";
import type { LeoSourceApp } from "@/models/LeoConversation";

export type EnabledLeoContext = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  role: string;
  sourceApp: LeoSourceApp;
};

function sourceAppForRole(role: string): LeoSourceApp {
  if (role === "teacher") return "teacher";
  if (role === "parent") return "parent";
  if (role === "student") return "student";
  return "admin";
}

export async function requireEnabledSchoolLeo(): Promise<EnabledLeoContext> {
  const member = await requireSchoolMember({
    allowedRoles: ["school_admin", "bursar", "billing_owner"],
  });
  const role = pickLeoAppRole(member.roles);
  const access = await resolveLeoAccess({
    schoolId: member.schoolId,
    role,
  });

  if (!access.effectiveEnabled) {
    throw NextResponse.json(
      {
        success: false,
        error: "leo_disabled",
        reason: access.reason,
        message: access.reasonDetail || "Leo Copilot is not enabled for this user.",
      },
      { status: 403 }
    );
  }

  return {
    userId: member.userId,
    schoolId: member.schoolId,
    role,
    sourceApp: sourceAppForRole(role),
  };
}
