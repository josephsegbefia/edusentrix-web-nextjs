import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { gatePlatformAdminUser } from "@/lib/auth/role-gates";
import { isInternalTestToolsEnabled } from "@/lib/internal-test/env";
import { userHasInternalTestManage } from "@/lib/internal-test/platform-access";

export async function requirePlatformInternalTestAccess() {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  await connectToDatabase();
  const meRaw = await User.findOne({ clerkUserId: userId })
    .select("_id role email platformPermissionKeys")
    .lean();
  const me = Array.isArray(meRaw) ? meRaw[0] : meRaw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gate = gatePlatformAdminUser(me as any);
  if (!gate.ok) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { success: false, error: gate.error, code: "FORBIDDEN" },
        { status: gate.status }
      ),
    };
  }

  if (!isInternalTestToolsEnabled()) {
    return {
      ok: false as const,
      res: NextResponse.json(
        {
          success: false,
          error: "Internal test tools are disabled in this environment.",
          code: "INTERNAL_TEST_TOOLS_DISABLED",
        },
        { status: 403 }
      ),
    };
  }

  if (!userHasInternalTestManage(me as Parameters<typeof userHasInternalTestManage>[0])) {
    return {
      ok: false as const,
      res: NextResponse.json(
        {
          success: false,
          error: "Missing permission: platform.internalTest.manage",
          code: "INTERNAL_TEST_PERMISSION",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    me: me as { _id: import("mongoose").Types.ObjectId; email?: string },
  };
}
