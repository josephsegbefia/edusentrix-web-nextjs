import "server-only";

import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { User, type IUser } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import type { MembershipRole } from "@/lib/roles";
import { gateSchoolAdminRoles, gateTeacherApiAccess } from "@/lib/auth/role-gates";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";

export type SchoolStaffReadContext = {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  /**
   * School admins may auto-create SchoolSettings on first GET.
   * Teachers and bursars get read-only access (synthetic defaults if nothing exists).
   */
  canBootstrapSchoolSettings: boolean;
  /** Present for users in the Teacher collection */
  teacherId?: mongoose.Types.ObjectId;
};

function legacyRoleToArray(role?: string): MembershipRole[] {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "bursar") return ["bursar"];
  if (role === "teacher") return ["teacher"];
  return ["staff"];
}

/**
 * Read-only school context for timetable UI: school admin, bursar, or active teacher
 * (same school). Used by GET handlers that must work for homeroom teachers building
 * class timetables without granting POST access to admin-only routes.
 */
export async function requireSchoolAdminOrTeacherRead(): Promise<SchoolStaffReadContext> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo && demo.user.schoolId) {
    await connectToDatabase();
    await ensureActiveSchoolForTenant(demo.user.schoolId as mongoose.Types.ObjectId, {
      mode: "api",
    });
    const roles = (demo.membership.roles || []) as MembershipRole[];
    if (gateSchoolAdminRoles(roles).ok) {
      return {
        userId: demo.user._id as mongoose.Types.ObjectId,
        schoolId: demo.user.schoolId as mongoose.Types.ObjectId,
        canBootstrapSchoolSettings: true,
      };
    }
    if (roles.includes("bursar")) {
      return {
        userId: demo.user._id as mongoose.Types.ObjectId,
        schoolId: demo.user.schoolId as mongoose.Types.ObjectId,
        canBootstrapSchoolSettings: false,
      };
    }
    const tg = gateTeacherApiAccess(roles);
    if (tg.ok) {
      const teacher = await Teacher.findOne({
        userId: demo.user._id,
        schoolId: demo.user.schoolId,
      })
        .select("_id")
        .lean();
      if (teacher) {
        return {
          userId: demo.user._id as mongoose.Types.ObjectId,
          schoolId: demo.user.schoolId as mongoose.Types.ObjectId,
          canBootstrapSchoolSettings: false,
          teacherId: (teacher as { _id: mongoose.Types.ObjectId })._id,
        };
      }
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const userRaw = await User.findOne({ clerkUserId }).lean();
  const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as Pick<
    IUser,
    "_id" | "schoolId" | "role"
  > | null;

  if (!user?.schoolId) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  let membership = (await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean()) as IUserMembership | null;

  if (!membership && user.schoolId) {
    membership = (await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    }).then((d) => d.toObject())) as IUserMembership;
  }

  const roles = (membership?.roles || []) as MembershipRole[];

  await ensureActiveSchoolForTenant(user.schoolId as mongoose.Types.ObjectId, { mode: "api" });

  if (gateSchoolAdminRoles(roles).ok) {
    return {
      userId: user._id as mongoose.Types.ObjectId,
      schoolId: user.schoolId as mongoose.Types.ObjectId,
      canBootstrapSchoolSettings: true,
    };
  }

  if (roles.includes("bursar")) {
    return {
      userId: user._id as mongoose.Types.ObjectId,
      schoolId: user.schoolId as mongoose.Types.ObjectId,
      canBootstrapSchoolSettings: false,
    };
  }

  const tg = gateTeacherApiAccess(roles);
  if (!tg.ok) {
    throw NextResponse.json({ error: tg.error }, { status: tg.status });
  }

  const teacher = await Teacher.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  })
    .select("_id")
    .lean();

  if (!teacher) {
    throw NextResponse.json({ error: "Teacher record not found" }, { status: 404 });
  }

  return {
    userId: user._id as mongoose.Types.ObjectId,
    schoolId: user.schoolId as mongoose.Types.ObjectId,
    canBootstrapSchoolSettings: false,
    teacherId: (teacher as { _id: mongoose.Types.ObjectId })._id,
  };
}
