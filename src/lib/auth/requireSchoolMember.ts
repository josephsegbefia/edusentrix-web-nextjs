// src/lib/auth/requireSchoolMember.ts
/**
 * Auth helper for participation routes (voting, donating, viewing).
 * Validates that the user is an active member of the school with one of the allowed roles.
 * Also supports token-based access for public polls/campaigns.
 */
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

export type MemberRole =
  | "school_admin"
  | "billing_owner"
  | "teacher"
  | "staff"
  | "parent"
  | "student"
  | "bursar";

export interface SchoolMemberContext {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: MemberRole[];
  isAdmin: boolean;
}

export interface RequireSchoolMemberOptions {
  /** Allowed roles. If empty, any active member is allowed. */
  allowedRoles?: MemberRole[];
  /** If true, allows unauthenticated access (for public token-based routes). */
  allowPublic?: boolean;
}

/**
 * Require the current user to be an active member of the school.
 * Optionally restrict to specific roles.
 *
 * @param options - Configuration options
 * @returns SchoolMemberContext with userId, schoolId, roles, and isAdmin flag
 * @throws NextResponse with 401 if not authenticated or not a member
 * @throws NextResponse with 403 if authenticated but lacks required role
 */
export async function requireSchoolMember(
  options: RequireSchoolMemberOptions = {}
): Promise<SchoolMemberContext> {
  const { allowedRoles = [], allowPublic = false } = options;

  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (allowPublic) {
      throw NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    if (active.reason === "needs_school_selection") {
      throw NextResponse.json({ error: "School selection required" }, { status: 409 });
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = active.context.roles as MemberRole[];
  const isAdmin = roles.includes("school_admin");

  // If specific roles required, check them
  if (allowedRoles.length > 0) {
    const hasAllowedRole = roles.some((r) => allowedRoles.includes(r));
    if (!hasAllowedRole && !isAdmin) {
      // Admins can always access
      throw NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }
  }

  return {
    userId: active.context.userId,
    schoolId: active.context.schoolId,
    roles,
    isAdmin,
  };
}

/**
 * Helper to check if user has a specific role.
 */
export function hasRole(context: SchoolMemberContext, role: MemberRole): boolean {
  return context.roles.includes(role) || context.isAdmin;
}

/**
 * Helper to check if user can vote (parent, student, teacher, staff).
 */
export function canVote(context: SchoolMemberContext): boolean {
  const votingRoles: MemberRole[] = ["parent", "student", "teacher", "staff"];
  return context.roles.some((r) => votingRoles.includes(r)) || context.isAdmin;
}

/**
 * Helper to check if user can donate (parent, staff, teacher).
 */
export function canDonate(context: SchoolMemberContext): boolean {
  const donatingRoles: MemberRole[] = ["parent", "teacher", "staff", "school_admin"];
  return context.roles.some((r) => donatingRoles.includes(r));
}
