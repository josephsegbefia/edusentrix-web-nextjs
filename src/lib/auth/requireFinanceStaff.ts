// src/lib/auth/requireFinanceStaff.ts
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";
import { gateFinanceStaffRoles } from "@/lib/auth/role-gates";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";

function legacyRoleToArray(role?: string) {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "bursar") return ["bursar"];
  if (role === "teacher") return ["teacher"];
  return ["staff"];
}

type FinanceStaffContext = {
  userId: NonNullable<IUser["_id"]>;
  schoolId: NonNullable<IUser["schoolId"]>;
  roles: string[];
};

export async function requireFinanceStaff(): Promise<FinanceStaffContext> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo) {
    await ensureActiveSchoolForTenant(demo.user.schoolId!, { mode: "api" });
    return {
      userId: demo.user._id,
      schoolId: demo.user.schoolId!,
      roles: [...demo.membership.roles],
    };
  }

  const assisted = await getActiveAssistedAccessSession();
  if (assisted) {
    await ensureActiveSchoolForTenant(assisted.schoolId, { mode: "api" });
    return {
      userId: assisted.actorUserId,
      schoolId: assisted.schoolId,
      roles: ["school_admin"],
    };
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const userRaw = await User.findOne({ clerkUserId }).lean();
  const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as Pick<
    IUser,
    "_id" | "schoolId" | "role"
  > | null;

  if (!user) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  let membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  });

  if (!membership && user.schoolId) {
    membership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
  }

  const roles = membership?.roles || [];
  const financeGate = gateFinanceStaffRoles(roles);
  if (!financeGate.ok) {
    throw NextResponse.json({ error: financeGate.error }, { status: financeGate.status });
  }

  if (!user.schoolId) {
    throw NextResponse.json(
      { error: "School context is missing for this account" },
      { status: 400 }
    );
  }

  await ensureActiveSchoolForTenant(user.schoolId, { mode: "api" });

  return { userId: user._id, schoolId: user.schoolId, roles };
}
