import "server-only";

import { NextResponse } from "next/server";
import { requireSchoolMember, type SchoolMemberContext } from "@/lib/auth/requireSchoolMember";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import type { BackgroundJobActor } from "./authorization";

export async function resolveBackgroundJobRouteActor(): Promise<
  { ok: true; actor: BackgroundJobActor } | { ok: false; res: NextResponse }
> {
  let schoolMember: SchoolMemberContext | null = null;
  let schoolError: NextResponse | null = null;
  try {
    schoolMember = await requireSchoolMember();
  } catch (error) {
    if (error instanceof NextResponse) {
      schoolError = error;
    } else {
      throw error;
    }
  }

  const platform = await requirePlatformPermission("platform.system.settings.read");

  if (schoolMember) {
    return {
      ok: true,
      actor: {
        userId: schoolMember.userId,
        schoolId: schoolMember.schoolId,
        isSchoolAdmin: schoolMember.isAdmin,
        isPlatformOperator: platform.ok,
      },
    };
  }

  if (platform.ok) {
    return {
      ok: true,
      actor: {
        userId: platform.actor.userId,
        isPlatformOperator: true,
      },
    };
  }

  return { ok: false, res: schoolError ?? platform.res };
}
