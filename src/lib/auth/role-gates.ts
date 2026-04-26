/**
 * Pure role checks used by `require*` auth helpers.
 * Keeps HTTP status + message consistent and gives unit tests a seam without Clerk/DB.
 */
import type { MembershipRole } from "@/lib/roles";

export type GateFailure = { ok: false; status: number; error: string };
export type GateSuccess = { ok: true };

export function gatePlatformAdminUser(
  me: { role?: string } | null | undefined
): GateSuccess | GateFailure {
  if (!me || me.role !== "platform_admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}

export function gateParentApiAccess(roles: MembershipRole[]): GateSuccess | GateFailure {
  const isAdmin = roles.includes("school_admin");
  const isParent = roles.includes("parent");
  if (!isParent && !isAdmin) {
    return { ok: false, status: 403, error: "Parent role required" };
  }
  return { ok: true };
}

export function gateFinanceStaffRoles(roles: string[]): GateSuccess | GateFailure {
  const allowed = roles.includes("school_admin") || roles.includes("bursar");
  if (!allowed) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

export function gateSchoolAdminRoles(roles: string[]): GateSuccess | GateFailure {
  if (!roles.includes("school_admin")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

export function gateTeacherApiAccess(roles: MembershipRole[]): GateSuccess | GateFailure {
  const isAdmin = roles.includes("school_admin");
  const isTeacher = roles.includes("teacher");
  if (!isTeacher && !isAdmin) {
    return { ok: false, status: 403, error: "Insufficient permissions" };
  }
  return { ok: true };
}

/**
 * Allows the school admin and any teacher delegated as `admissions_officer`.
 * See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §4.
 */
export function gateAdmissionsManager(input: {
  roles: string[];
  subroles?: string[];
}): GateSuccess | GateFailure {
  const isAdmin = input.roles.includes("school_admin");
  const isOfficer = (input.subroles ?? []).includes("admissions_officer");
  if (!isAdmin && !isOfficer) {
    return { ok: false, status: 403, error: "Admissions access required" };
  }
  return { ok: true };
}
