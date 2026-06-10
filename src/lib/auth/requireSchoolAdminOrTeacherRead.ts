import "server-only";

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import type { MembershipRole } from "@/lib/roles";
import { gateSchoolAdminRoles, gateTeacherApiAccess } from "@/lib/auth/role-gates";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

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

/**
 * Read-only school context for timetable UI: school admin, bursar, or active teacher
 * (same school). Used by GET handlers that must work for homeroom teachers building
 * class timetables without granting POST access to admin-only routes.
 */
export async function requireSchoolAdminOrTeacherRead(): Promise<SchoolStaffReadContext> {
  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "needs_school_selection") {
      throw NextResponse.json({ error: "School selection required" }, { status: 409 });
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const roles = active.context.roles;

  if (gateSchoolAdminRoles(roles).ok) {
    return {
      userId: active.context.userId,
      schoolId: active.context.schoolId,
      canBootstrapSchoolSettings: true,
    };
  }

  if (roles.includes("bursar")) {
    return {
      userId: active.context.userId,
      schoolId: active.context.schoolId,
      canBootstrapSchoolSettings: false,
    };
  }

  const tg = gateTeacherApiAccess(roles);
  if (!tg.ok) {
    throw NextResponse.json({ error: tg.error }, { status: tg.status });
  }

  const teacher = await Teacher.findOne({
    userId: active.context.userId,
    schoolId: active.context.schoolId,
  })
    .select("_id")
    .lean();

  if (!teacher) {
    throw NextResponse.json({ error: "Teacher record not found" }, { status: 404 });
  }

  return {
    userId: active.context.userId,
    schoolId: active.context.schoolId,
    canBootstrapSchoolSettings: false,
    teacherId: (teacher as { _id: mongoose.Types.ObjectId })._id,
  };
}
