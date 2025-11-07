export type AppRole =
  | "platform_admin"
  | "school_admin"
  | "teacher"
  | "parent"
  | "student";

export function routeForRoles(roles: AppRole[], pendingOnboarding: boolean) {
  if (roles.includes("platform_admin")) return "/platform";
  if (roles.includes("school_admin"))
    return pendingOnboarding ? "/onboard" : "/dashboard";
  if (roles.includes("teacher")) return "/teacher";
  if (roles.includes("parent")) return "/parent";
  if (roles.includes("student")) return "/student";
  return "/dashboard";
}
