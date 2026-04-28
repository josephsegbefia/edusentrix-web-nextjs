import "server-only";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import {
  delegatedAdminNavItemsForPermissions,
  delegatedAdminPathPrefixesForPermissions,
} from "@/lib/delegations/delegate-admin-access";
import type { DelegatedAdminNavItem } from "@/lib/delegations/delegate-admin-access";
import type { CurrentAppUser } from "@/lib/auth/get-current-user";

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
export async function resolveAdminShellAccess(
  user: CurrentAppUser
): Promise<AdminShellAccess> {
  if (!user.schoolId) {
    redirect("/dashboard");
  }

  if (user.role === "bursar") {
    await connectToDatabase();
    const schoolId = new mongoose.Types.ObjectId(user.schoolId);
    const userId = new mongoose.Types.ObjectId(user._id);
    const permissions = await mergedDelegationPermissions(schoolId, userId);
    const delegatedAdminPrefixes =
      delegatedAdminPathPrefixesForPermissions(permissions);
    const delegatedNavItems =
      delegatedAdminNavItemsForPermissions(permissions);
    return {
      kind: "bursar",
      delegatedAdminPrefixes,
      delegatedNavItems,
    };
  }
  if (user.role === "billing_owner") {
    return { kind: "billing_owner" };
  }
  if (user.role === "school_admin") {
    return { kind: "full_school_admin" };
  }

  const demo = await tryResolveDemoGuard();
  if (demo.isDemo) {
    const roles = (demo.membership.roles ?? []) as string[];
    if (roles.includes("school_admin")) {
      return { kind: "full_school_admin" };
    }
  }

  await connectToDatabase();
  const schoolId = new mongoose.Types.ObjectId(user.schoolId);
  const userId = new mongoose.Types.ObjectId(user._id);

  const membership = await UserMembership.findOne({
    userId,
    schoolId,
    status: "active",
  })
    .select({ roles: 1 })
    .lean<{ roles?: string[] } | null>();

  const roles = (membership?.roles ?? []) as string[];
  if (roles.includes("school_admin")) {
    return { kind: "full_school_admin" };
  }

  if (user.role !== "teacher" && user.role !== "staff") {
    redirect("/dashboard");
  }

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

  redirect("/dashboard");
}
