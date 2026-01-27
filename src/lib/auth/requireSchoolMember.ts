// src/lib/auth/requireSchoolMember.ts
/**
 * Auth helper for participation routes (voting, donating, viewing).
 * Validates that the user is an active member of the school with one of the allowed roles.
 * Also supports token-based access for public polls/campaigns.
 */
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";
import { UserMembership, IUserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

export type MemberRole = "school_admin" | "teacher" | "staff" | "parent" | "student" | "bursar";

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

function legacyRoleToArray(role?: string): MemberRole[] {
  if (role === "school_admin") return ["school_admin"];
  if (role === "teacher") return ["teacher"];
  if (role === "parent") return ["parent"];
  if (role === "student") return ["student"];
  if (role === "bursar") return ["bursar"];
  return ["staff"];
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

  const { userId: clerkUserId } = await auth();

  // If not authenticated
  if (!clerkUserId) {
    if (allowPublic) {
      // For public routes, we'll handle this differently in the route
      throw NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  // Find user
  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<IUser, "_id" | "schoolId" | "role"> | null;

  if (!user) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  if (!user.schoolId) {
    throw NextResponse.json({ error: "User not associated with a school" }, { status: 401 });
  }

  // Find or create membership
  let membership = (await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean()) as IUserMembership | null;

  // Auto-backfill for dev convenience
  if (!membership) {
    const createdMembership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
    membership = createdMembership.toObject() as IUserMembership;
  }

  // Check membership status
  if (membership.status !== "active") {
    throw NextResponse.json(
      { error: "Membership is not active" },
      { status: 403 }
    );
  }

  const roles = (membership.roles || []) as MemberRole[];
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
    userId: user._id as Types.ObjectId,
    schoolId: user.schoolId as Types.ObjectId,
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
