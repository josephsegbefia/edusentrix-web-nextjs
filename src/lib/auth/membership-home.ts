import type { MembershipRole } from "@/lib/roles";

/** Role-home routing derived from active membership roles (not User.role). */
export function homePathForMembershipRoles(roles: MembershipRole[]): string {
  if (roles.includes("school_admin")) return "/admin";
  if (roles.includes("billing_owner")) return "/admin/settings/payment-setup";
  if (roles.includes("bursar")) return "/bursar";
  if (roles.includes("teacher")) return "/teacher";
  if (roles.includes("parent")) return "/parent";
  if (roles.includes("student")) return "/student";
  return "/dashboard";
}
