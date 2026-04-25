import type { MemberRole } from "@/lib/auth/requireSchoolMember";

/**
 * Map membership roles to a single role for Leo policy (admin shell users).
 */
export function pickLeoAppRole(roles: MemberRole[]): string {
  if (roles.includes("school_admin")) return "school_admin";
  if (roles.includes("bursar")) return "bursar";
  if (roles.includes("billing_owner")) return "billing_owner";
  if (roles.includes("teacher")) return "teacher";
  if (roles.includes("parent")) return "parent";
  if (roles.includes("student")) return "student";
  return roles[0] ?? "staff";
}
