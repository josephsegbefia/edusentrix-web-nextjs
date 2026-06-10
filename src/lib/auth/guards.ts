// src/lib/auth/guards.ts
import "server-only";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/roles";
import type { CurrentAppUser } from "./get-current-user";
import { getCurrentUser } from "./get-current-user";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

/**
 * @deprecated Prefer membership-aware guards such as `requireParent`, `requireTeacher`,
 * or `resolveActiveSchoolContext` for school tenant access. Still used for platform-only
 * role checks (e.g. `platform_admin`).
 */
export function assertRole(user: CurrentAppUser | null, allowed: AppRole[]) {
  if (!user) redirect("/login");
  if (!user.role || !allowed.includes(user.role)) {
    // Optional: send to a nicer 403 page
    redirect("/dashboard");
  }
}

/**
 * Require user to have one of the specified roles
 * Returns the user object if authorized, null if not
 * Used in API routes where you need the user object and want to handle errors manually
 */
export async function requireRole(...allowedRoles: AppRole[]) {
  const active = await resolveActiveSchoolContext();
  if (active.ok) {
    const role = active.context.roles.find((candidate) =>
      allowedRoles.includes(candidate as AppRole)
    ) as AppRole | undefined;
    if (!role) return null;
    return {
      _id: active.context.userId,
      schoolId: active.context.schoolId,
      role,
      roles: active.context.roles,
    };
  }

  const me = await getCurrentUser();
  if (!me?.role || !allowedRoles.includes(me.role)) return null;
  return me;
}
