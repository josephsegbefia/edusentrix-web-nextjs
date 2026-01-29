/**
 * Centralized role definitions for the application
 * This is the single source of truth for all role types
 */

export type AppRole =
  | "platform_admin"
  | "school_admin"
  | "bursar"
  | "staff"
  | "teacher"
  | "parent"
  | "student";

/**
 * Roles that can be invited via the invitation system
 * These are school-level roles that require invitations
 */
export type InvitationRole = "teacher" | "staff" | "school_admin";

/**
 * Roles that can be assigned via UserMembership
 * These are school-level roles within a membership context
 */
export type MembershipRole =
  | "school_admin"
  | "bursar"
  | "staff"
  | "teacher"
  | "parent"
  | "student";

/**
 * Check if a role is an invitation role
 */
export function isInvitationRole(role: string): role is InvitationRole {
  return ["teacher", "staff", "school_admin"].includes(role);
}

/**
 * Check if a role is a membership role
 */
export function isMembershipRole(role: string): role is MembershipRole {
  return ["school_admin", "bursar", "staff", "teacher", "parent", "student"].includes(
    role
  );
}

/**
 * Get the default route for a user based on their roles
 */
export function routeForRoles(roles: AppRole[], pendingOnboarding: boolean) {
  if (roles.includes("platform_admin")) return "/platform";
  if (roles.includes("school_admin"))
    return pendingOnboarding ? "/onboard" : "/dashboard";
  if (roles.includes("teacher")) return "/teacher";
  if (roles.includes("parent")) return "/parent";
  if (roles.includes("student")) return "/student";
  return "/dashboard";
}
