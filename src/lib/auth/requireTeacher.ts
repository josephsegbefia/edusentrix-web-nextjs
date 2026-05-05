import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import type { MembershipRole } from "@/lib/roles";
import {
  resolvePermissions,
  type Permission,
  type TeacherSubrole,
} from "@/lib/rbac";
import { gateTeacherApiAccess } from "@/lib/auth/role-gates";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";

export interface TeacherContext {
  userId: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: MembershipRole[];
  /** Membership/Teacher labels only; not used for permission checks (see DELEGATIONS_FEATURE_SPEC §3). */
  subroles: TeacherSubrole[];
  permissions: Permission[];
  homeroomClassGroupId?: Types.ObjectId | null;
  isAdmin: boolean;
}

type RequireTeacherOptions = {
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

export async function requireTeacher(
  options: RequireTeacherOptions = {}
): Promise<TeacherContext> {
  const { mode = "api" } = options;

  const demo = await tryResolveDemoGuard();
  if (demo.isDemo && demo.user.schoolId) {
    await connectToDatabase();
    const teacher = await Teacher.findOne({
      userId: demo.user._id,
      schoolId: demo.user.schoolId,
    })
      .select("_id homeroomClassGroupId subroles")
      .lean();
    if (teacher) {
      await ensureActiveSchoolForTenant(demo.user.schoolId as Types.ObjectId, {
        mode,
      });
      const roles = [...demo.membership.roles] as MembershipRole[];
      const subroles = ((teacher as { subroles?: string[] }).subroles ||
        []) as TeacherSubrole[];
      return {
        userId: demo.user._id as Types.ObjectId,
        teacherId: (teacher as { _id: Types.ObjectId })._id,
        schoolId: demo.user.schoolId as Types.ObjectId,
        roles,
        subroles,
        permissions: resolvePermissions({ roles }),
        homeroomClassGroupId: (
          teacher as { homeroomClassGroupId?: Types.ObjectId | null }
        ).homeroomClassGroupId,
        isAdmin: roles.includes("school_admin"),
      };
    }
  }

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
  const teacherGate = gateTeacherApiAccess(roles);
  if (!teacherGate.ok) {
    handleFailure(mode, teacherGate.status, teacherGate.error);
  }

  const teacher = await Teacher.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  })
    .select("_id homeroomClassGroupId subroles")
    .lean();

  if (!teacher) {
    handleFailure(mode, 404, "Teacher record not found");
  }

  const membershipSubroles = (membership.subroles || []) as TeacherSubrole[];
  const teacherSubroles = ((teacher as { subroles?: string[] }).subroles || []) as
    | TeacherSubrole[]
    | undefined;
  const subroles = (membershipSubroles.length > 0
    ? membershipSubroles
    : teacherSubroles || []) as TeacherSubrole[];

  const permissions = resolvePermissions({ roles });

  await ensureActiveSchoolForTenant(user.schoolId as Types.ObjectId, { mode });

  return {
    userId: user._id as Types.ObjectId,
    teacherId: (teacher as { _id: Types.ObjectId })._id,
    schoolId: user.schoolId as Types.ObjectId,
    roles,
    subroles,
    permissions,
    homeroomClassGroupId: (teacher as { homeroomClassGroupId?: Types.ObjectId | null })
      .homeroomClassGroupId,
    isAdmin,
  };
}
