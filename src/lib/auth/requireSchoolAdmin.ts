import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { validateInternalTestImpersonationSession } from "@/lib/internal-test/validate-impersonation-session";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";

function legacyRoleToArray(role?: string) {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "teacher") return ["teacher"];
  return ["staff"];
}

type SchoolAdminContext = {
  userId: NonNullable<IUser["_id"]>;
  schoolId: NonNullable<IUser["schoolId"]>;
};

export async function requireSchoolAdmin(): Promise<SchoolAdminContext> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo) {
    await ensureActiveSchoolForTenant(demo.user.schoolId!, { mode: "api" });
    return {
      userId: demo.user._id,
      schoolId: demo.user.schoolId!,
    };
  }

  const ita = await validateInternalTestImpersonationSession();
  if (ita) {
    const t = ita.target;
    if (!t.schoolId) {
      throw NextResponse.json({ error: "Invalid impersonation target (no school)" }, { status: 403 });
    }
    let membership = await UserMembership.findOne({
      userId: t._id,
      schoolId: t.schoolId,
    });
    if (!membership) {
      membership = await UserMembership.create({
        userId: t._id,
        schoolId: t.schoolId,
        roles: legacyRoleToArray(t.role),
        status: "active",
      });
    }
    const roles = membership.roles || [];
    const adminGate = gateSchoolAdminRoles(roles);
    if (!adminGate.ok) {
      throw NextResponse.json({ error: adminGate.error }, { status: adminGate.status });
    }
    await ensureActiveSchoolForTenant(t.schoolId, { mode: "api" });
    return { userId: t._id, schoolId: t.schoolId };
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId)
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<
    IUser,
    "_id" | "schoolId" | "role"
  > | null;
  if (!user)
    throw NextResponse.json({ error: "User not found" }, { status: 401 });

  // Try membership
  let membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  });
  // auto-backfill (dev friendly)
  if (!membership && user.schoolId) {
    membership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
  }

  const roles = membership?.roles || [];
  const adminGate = gateSchoolAdminRoles(roles);
  if (!adminGate.ok) {
    throw NextResponse.json({ error: adminGate.error }, { status: adminGate.status });
  }

  if (!user.schoolId) {
    throw NextResponse.json(
      { error: "School context is missing for this account" },
      { status: 400 }
    );
  }

  await ensureActiveSchoolForTenant(user.schoolId, { mode: "api" });

  return { userId: user._id, schoolId: user.schoolId };
}
