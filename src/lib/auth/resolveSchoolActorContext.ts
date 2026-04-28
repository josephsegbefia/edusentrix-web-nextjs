import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";

function legacyRoleToArray(role?: string) {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "teacher") return ["teacher"];
  if (role === "bursar") return ["bursar"];
  return ["staff"];
}

export type SchoolActorContext = {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  isSchoolAdmin: boolean;
};

/**
 * Clerk user + school membership, with `isSchoolAdmin` from membership roles.
 * Used by delegated module routes and meetings helpers.
 */
export async function resolveSchoolActorContext(): Promise<SchoolActorContext> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo) {
    if (!demo.user.schoolId) {
      throw NextResponse.json({ error: "School context is missing" }, { status: 400 });
    }
    const roles = (demo.membership.roles ?? []) as string[];
    const isSchoolAdmin = roles.includes("school_admin");
    return {
      userId: demo.user._id as mongoose.Types.ObjectId,
      schoolId: demo.user.schoolId as mongoose.Types.ObjectId,
      isSchoolAdmin,
    };
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<IUser, "_id" | "schoolId" | "role"> | null;
  if (!user) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  let membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  });
  if (!membership && user.schoolId) {
    membership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
  }

  if (!user.schoolId) {
    throw NextResponse.json(
      { error: "School context is missing for this account" },
      { status: 400 }
    );
  }

  const roles = membership?.roles || [];
  const adminGate = gateSchoolAdminRoles(roles);
  if (adminGate.ok) {
    return { userId: user._id, schoolId: user.schoolId, isSchoolAdmin: true };
  }

  return { userId: user._id, schoolId: user.schoolId, isSchoolAdmin: false };
}
