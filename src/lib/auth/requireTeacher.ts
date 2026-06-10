import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import type { MembershipRole } from "@/lib/roles";
import {
  resolvePermissions,
  type Permission,
  type TeacherSubrole,
} from "@/lib/rbac";
import { gateTeacherApiAccess } from "@/lib/auth/role-gates";
import { assertActiveSchoolEnabled } from "@/lib/auth/assert-active-school-enabled";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

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

function handleFailure(
  mode: "api" | "page",
  status: number,
  message: string
): never {
  if (mode === "page") {
    if (status === 401) redirect("/sign-in");
    if (status === 409) redirect("/auth/switch");
    redirect("/dashboard");
  }
  throw NextResponse.json({ error: message }, { status });
}

export async function requireTeacher(
  options: RequireTeacherOptions = {}
): Promise<TeacherContext> {
  const { mode = "api" } = options;

  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    handleFailure(
      mode,
      active.reason === "needs_school_selection" ? 409 : active.reason === "unauthorized" ? 401 : 403,
      active.reason === "needs_school_selection" ? "School selection required" : "Unauthorized"
    );
  }

  await connectToDatabase();

  const roles = active.context.roles;
  const isAdmin = roles.includes("school_admin");
  const teacherGate = gateTeacherApiAccess(roles);
  if (!teacherGate.ok) {
    handleFailure(mode, teacherGate.status, teacherGate.error);
  }

  if (mode === "page") {
    await assertActiveSchoolEnabled(active.context.schoolId);
  }

  const teacher = await Teacher.findOne({
    userId: active.context.userId,
    schoolId: active.context.schoolId,
  })
    .select("_id homeroomClassGroupId subroles")
    .lean();

  if (!teacher) {
    handleFailure(mode, 404, "Teacher record not found");
  }

  const membershipSubroles = (active.context.subroles || []) as TeacherSubrole[];
  const teacherSubroles = ((teacher as { subroles?: string[] }).subroles || []) as
    | TeacherSubrole[]
    | undefined;
  const subroles = (membershipSubroles.length > 0
    ? membershipSubroles
    : teacherSubroles || []) as TeacherSubrole[];

  const permissions = resolvePermissions({ roles });

  return {
    userId: active.context.userId,
    teacherId: (teacher as { _id: Types.ObjectId })._id,
    schoolId: active.context.schoolId,
    roles,
    subroles,
    permissions,
    homeroomClassGroupId: (teacher as { homeroomClassGroupId?: Types.ObjectId | null })
      .homeroomClassGroupId,
    isAdmin,
  };
}
