import "server-only";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import {
  delegatedAdminNavItemsForPermissions,
  delegatedAdminPathPrefixesForPermissions,
} from "@/lib/delegations/delegate-admin-access";
import type { DelegatedAdminNavItem } from "@/lib/delegations/delegate-admin-access";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { assertActiveSchoolEnabled } from "@/lib/auth/assert-active-school-enabled";

export type AdminShellAccess =
  | { kind: "full_school_admin" }
  | {
      kind: "bursar";
      delegatedAdminPrefixes: string[];
      delegatedNavItems: DelegatedAdminNavItem[];
    }
  | { kind: "billing_owner" }
  | {
      kind: "delegated_admin";
      allowedPathPrefixes: string[];
      navItems: DelegatedAdminNavItem[];
      homeHref: string;
    };

function pickDelegateHomeHref(items: DelegatedAdminNavItem[]): string {
  if (items.length === 0) return "/admin";
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));
  return sorted[0].href;
}

/**
 * Resolves whether the signed-in user may use the admin app shell.
 * Teachers/staff with active delegations for implemented `/admin` modules
 * enter a restricted shell (union of those routes).
 */
export async function resolveAdminShellAccess(): Promise<AdminShellAccess> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo) {
    const roles = (demo.membership.roles ?? []) as string[];
    if (roles.includes("school_admin")) {
      return { kind: "full_school_admin" };
    }
    if (roles.includes("billing_owner")) {
      return { kind: "billing_owner" };
    }
    if (roles.includes("bursar")) {
      const schoolId = demo.user.schoolId as mongoose.Types.ObjectId;
      const userId = demo.user._id as mongoose.Types.ObjectId;
      const permissions = await mergedDelegationPermissions(schoolId, userId);
      return {
        kind: "bursar",
        delegatedAdminPrefixes: delegatedAdminPathPrefixesForPermissions(permissions),
        delegatedNavItems: delegatedAdminNavItemsForPermissions(permissions),
      };
    }
  }

  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "needs_school_selection") {
      redirect("/auth/switch");
    }
    redirect("/dashboard");
  }

  await connectToDatabase();
  await assertActiveSchoolEnabled(active.context.schoolId);

  const roles = active.context.roles;
  const schoolId = active.context.schoolId;
  const userId = active.context.userId;

  if (roles.includes("school_admin")) {
    return { kind: "full_school_admin" };
  }
  if (roles.includes("billing_owner")) {
    return { kind: "billing_owner" };
  }
  if (roles.includes("bursar")) {
    const permissions = await mergedDelegationPermissions(schoolId, userId);
    return {
      kind: "bursar",
      delegatedAdminPrefixes: delegatedAdminPathPrefixesForPermissions(permissions),
      delegatedNavItems: delegatedAdminNavItemsForPermissions(permissions),
    };
  }

  if (roles.includes("teacher") || roles.includes("staff")) {
    const permissions = await mergedDelegationPermissions(schoolId, userId);
    const allowedPathPrefixes =
      delegatedAdminPathPrefixesForPermissions(permissions);
    if (allowedPathPrefixes.length > 0) {
      const navItems = delegatedAdminNavItemsForPermissions(permissions);
      return {
        kind: "delegated_admin",
        allowedPathPrefixes,
        navItems,
        homeHref: pickDelegateHomeHref(navItems),
      };
    }
  }

  redirect("/dashboard");
}
