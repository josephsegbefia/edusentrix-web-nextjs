// src/app/api/me/route.ts
// import { NextResponse } from "next/server";
// import { auth } from "@clerk/nextjs/server";
// import { getCurrentUser } from "@/lib/auth/get-current-user";

// export async function GET() {
//   const { userId } = await auth();
//   if (!userId) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   const me = await getCurrentUser();
//   if (!me) {
//     return NextResponse.json({ error: "No profile" }, { status: 404 });
//   }
//   return NextResponse.json(me);
// }

// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  resolveActiveSchoolContext,
  type ActiveSchoolContext,
} from "@/lib/auth/active-school-context";
import type { AppRole, MembershipRole } from "@/lib/roles";
import { User } from "@/models/User";

function primaryRoleForMembership(roles: MembershipRole[]): AppRole {
  if (roles.includes("school_admin")) return "school_admin";
  if (roles.includes("billing_owner")) return "billing_owner";
  if (roles.includes("bursar")) return "bursar";
  if (roles.includes("teacher")) return "teacher";
  if (roles.includes("parent")) return "parent";
  if (roles.includes("student")) return "student";
  return "staff";
}

function computeRedirect(me: { pendingOnboarding?: boolean; role?: AppRole } | null) {
  if (!me) return null;

  if (me.pendingOnboarding) return "/launch";
  if (me.role === "school_admin") return "/admin";
  if (me.role === "billing_owner") return "/admin/settings/payment-setup";
  if (me.role === "platform_admin") return "/platform";
  if (me.role === "teacher") return "/teacher";
  if (me.role === "parent") return "/parent";
  if (me.role === "student") return "/student";
  if (me.role === "bursar") return "/bursar";
  return null;
}

async function buildActiveSchoolUser(context: ActiveSchoolContext) {
  await connectToDatabase();
  const user = await User.findById(context.userId)
    .select("email name firstName lastName avatarUrl pendingOnboarding termsAccepted privacyAccepted termsVersion privacyVersion createdAt updatedAt")
    .lean();
  const name =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    undefined;
  const role = primaryRoleForMembership(context.roles);

  return {
    _id: String(context.userId),
    email: user?.email || "",
    name,
    avatarUrl: user?.avatarUrl,
    role,
    roles: context.roles,
    subroles: context.subroles,
    schoolId: String(context.schoolId),
    schoolName: context.schoolName,
    membershipId: context.membershipId ? String(context.membershipId) : null,
    pendingOnboarding: Boolean(user?.pendingOnboarding),
    termsAccepted: Boolean(user?.termsAccepted),
    privacyAccepted: Boolean(user?.privacyAccepted),
    termsVersion: user?.termsVersion ?? undefined,
    privacyVersion: user?.privacyVersion ?? undefined,
    createdAt: user?.createdAt,
    updatedAt: user?.updatedAt,
  };
}

function successfulPayload(user: Record<string, unknown>, context?: ActiveSchoolContext) {
  const redirect =
    context?.homePath ||
    computeRedirect({
      role: user.role as AppRole | undefined,
      pendingOnboarding: Boolean(user.pendingOnboarding),
    });

  return {
    ...user,
    ok: true,
    success: true,
    user,
    data: user,
    ...(redirect ? { redirect } : {}),
    ...(context
      ? {
          activeSchool: {
            schoolId: String(context.schoolId),
            schoolName: context.schoolName,
            roles: context.roles,
            homePath: context.homePath,
            source: context.source,
          },
          memberships: context.memberships,
          needsSchoolSelection: false,
        }
      : {}),
  };
}

async function loadMeForClerkUser(clerkUserId?: string | null) {
  const active = await resolveActiveSchoolContext({ clerkUserId });
  if (active.ok) {
    const user = await buildActiveSchoolUser(active.context);
    return successfulPayload(user, active.context);
  }

  const me = await getCurrentUser(clerkUserId ?? undefined);
  if (me?.role === "platform_admin") {
    return successfulPayload(me);
  }

  if (
    active.reason === "needs_school_selection" ||
    active.reason === "membership_suspended" ||
    active.reason === "no_memberships"
  ) {
    return {
      ok: true,
      success: true,
      user: me,
      data: me,
      needsSchoolSelection: active.reason === "needs_school_selection",
      reason: active.reason,
      memberships: active.memberships || [],
      redirect: active.reason === "needs_school_selection" ? "/auth/switch" : computeRedirect(me),
    };
  }

  if (active.reason === "unauthorized") {
    return null;
  }

  return me ? successfulPayload(me) : null;
}

export async function GET(req: NextRequest) {
  const authz = req.headers.get("authorization");
  const hasBearer = !!authz?.toLowerCase().startsWith("bearer ");

  let userId: string | null = null;

  // --- MOBILE (Bearer token) ---
  if (hasBearer) {
    const token = authz!.slice(7);
    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      userId = verified.sub ?? null;
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const payload = await loadMeForClerkUser(userId);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { message: "No profile" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      "data" in payload ? payload : { success: true, data: payload }
    );
  }

  // --- WEB (cookie session) ---
  const a = await auth();
  userId = a.userId ?? null;

  if (!userId) {
    // Keep existing behavior your web code expects
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await loadMeForClerkUser(userId);
  if (!payload) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
