// src/lib/auth/requireAdmissionsManager.ts
// Auth helper for the Admissions feature.
// Allows: school_admin (always) OR teacher with `admissions_officer` subrole.
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §4.

import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { gateAdmissionsManager } from "@/lib/auth/role-gates";

export interface AdmissionsManagerContext {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: string[];
  subroles: string[];
  isAdmin: boolean;
  /** True when the user is an admissions officer but NOT also a school admin. */
  isDelegate: boolean;
}

function legacyRoleToArray(role?: string): string[] {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "teacher") return ["teacher"];
  if (role === "parent") return ["parent"];
  if (role === "student") return ["student"];
  if (role === "bursar") return ["bursar"];
  return ["staff"];
}

export async function requireAdmissionsManager(): Promise<AdmissionsManagerContext> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo && demo.user.schoolId) {
    const roles = [...demo.membership.roles] as string[];
    const subroles = [...(demo.membership.subroles ?? [])] as string[];
    const gate = gateAdmissionsManager({ roles, subroles });
    if (!gate.ok) {
      throw NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const isAdmin = roles.includes("school_admin");
    return {
      userId: demo.user._id as Types.ObjectId,
      schoolId: demo.user.schoolId as Types.ObjectId,
      roles,
      subroles,
      isAdmin,
      isDelegate: !isAdmin && subroles.includes("admissions_officer"),
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

  if (!user.schoolId) {
    throw NextResponse.json(
      { error: "User is not associated with a school" },
      { status: 400 }
    );
  }

  let membership = (await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean()) as IUserMembership | null;

  if (!membership) {
    const created = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
    membership = created.toObject() as IUserMembership;
  }

  if (membership.status !== "active") {
    throw NextResponse.json(
      { error: "Membership is not active" },
      { status: 403 }
    );
  }

  const roles = (membership.roles ?? []) as string[];
  const subroles = (membership.subroles ?? []) as string[];

  const gate = gateAdmissionsManager({ roles, subroles });
  if (!gate.ok) {
    throw NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const isAdmin = roles.includes("school_admin");
  return {
    userId: user._id as Types.ObjectId,
    schoolId: user.schoolId as Types.ObjectId,
    roles,
    subroles,
    isAdmin,
    isDelegate: !isAdmin && subroles.includes("admissions_officer"),
  };
}
