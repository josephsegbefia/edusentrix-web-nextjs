import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import { Guardian } from "@/models/Guardian";
import type { MembershipRole } from "@/lib/roles";
import { gateParentApiAccess } from "@/lib/auth/role-gates";

export interface ParentContext {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: MembershipRole[];
  isAdmin: boolean;
}

type RequireParentOptions = {
  mode?: "api" | "page";
};

function legacyRoleToArray(role?: string): MembershipRole[] {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "bursar") return ["bursar"];
  if (role === "teacher") return ["teacher"];
  if (role === "parent") return ["parent"];
  if (role === "student") return ["student"];
  if (role === "staff") return ["staff"];
  return ["staff"];
}

function handleFailure(
  mode: "api" | "page",
  status: number,
  message: string
): never {
  if (mode === "page") {
    if (status === 401) redirect("/sign-in");
    redirect("/dashboard");
  }
  throw NextResponse.json({ error: message }, { status });
}

/**
 * Require the current user to be an authenticated parent.
 * Used for parent-specific API routes and pages.
 */
export async function requireParent(
  options: RequireParentOptions = {}
): Promise<ParentContext> {
  const { mode = "api" } = options;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    handleFailure(mode, 401, "Unauthorized");
  }

  await connectToDatabase();

  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<IUser, "_id" | "schoolId" | "role"> | null;

  if (!user) {
    handleFailure(mode, 401, "User not found");
  }

  if (!user.schoolId) {
    handleFailure(mode, 401, "User not associated with a school");
  }

  let membership = (await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean()) as IUserMembership | null;

  if (!membership) {
    const createdMembership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
    membership = createdMembership.toObject() as IUserMembership;
  }

  if (membership.status !== "active") {
    handleFailure(mode, 403, "Membership is not active");
  }

  const roles = (membership.roles || []) as MembershipRole[];
  const isAdmin = roles.includes("school_admin");
  const parentGate = gateParentApiAccess(roles);
  if (!parentGate.ok) {
    handleFailure(mode, parentGate.status, parentGate.error);
  }

  return {
    userId: user._id as Types.ObjectId,
    schoolId: user.schoolId as Types.ObjectId,
    roles,
    isAdmin,
  };
}

/**
 * Verify that a parent has guardian access to a specific student.
 * Throws 403 if the parent is not linked to the student via Guardian model.
 */
export async function verifyGuardianAccess(
  parentUserId: Types.ObjectId,
  studentId: string,
  options: { mode?: "api" | "page" } = {}
): Promise<{ guardianId: Types.ObjectId; isPrimary: boolean }> {
  const { mode = "api" } = options;

  const guardian = await Guardian.findOne({
    userId: parentUserId,
    studentId: new Types.ObjectId(studentId),
  })
    .select("_id isPrimary")
    .lean();

  if (!guardian) {
    if (mode === "page") {
      redirect("/parent");
    }
    throw NextResponse.json(
      { error: "You do not have access to this student" },
      { status: 403 }
    );
  }

  return {
    guardianId: (guardian as { _id: Types.ObjectId })._id,
    isPrimary: (guardian as { isPrimary: boolean }).isPrimary,
  };
}

/**
 * Get all student IDs that a parent has guardian access to.
 */
export async function getParentWardIds(
  parentUserId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  const guardians = await Guardian.find({ userId: parentUserId })
    .select("studentId")
    .lean();

  return guardians.map(
    (g) => (g as { studentId: Types.ObjectId }).studentId
  );
}
