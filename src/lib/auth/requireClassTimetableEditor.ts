import "server-only";

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Teacher } from "@/models/Teacher";
import type { MembershipRole } from "@/lib/roles";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import type { SchoolStaffReadContext } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

export type ClassTimetableEditorContext = {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  mode: "school_admin" | "homeroom_teacher";
  /** Present when mode is homeroom_teacher */
  teacherId?: mongoose.Types.ObjectId;
};

function toObjectId(value: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * School admin full access, or homeroom teacher for this class only.
 * Homeroom = ClassGroup.homeroomTeacherId matches teacher doc, or Teacher.homeroomClassGroupId matches class.
 */
export async function requireClassTimetableEditor(
  classGroupId: string
): Promise<ClassTimetableEditorContext> {
  const classObjId = toObjectId(classGroupId);
  if (!classObjId) {
    throw NextResponse.json({ error: "Invalid class id" }, { status: 400 });
  }

  await connectToDatabase();

  const classGroup = await ClassGroup.findById(classObjId)
    .select("_id schoolId homeroomTeacherId")
    .lean();
  if (!classGroup) {
    throw NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const schoolIdObj = (classGroup as { schoolId: mongoose.Types.ObjectId }).schoolId;

  const demo = await tryResolveDemoGuard();
  if (demo.isDemo && demo.user.schoolId) {
    const roles = (demo.membership.roles || []) as MembershipRole[];
    if (roles.includes("school_admin") && String(demo.user.schoolId) === String(schoolIdObj)) {
      return {
        userId: demo.user._id as mongoose.Types.ObjectId,
        schoolId: schoolIdObj,
        mode: "school_admin",
      };
    }
    const teacher = await Teacher.findOne({
      userId: demo.user._id,
      schoolId: schoolIdObj,
    })
      .select("_id homeroomClassGroupId")
      .lean();
    const homeroomMatch =
      !!teacher &&
      (String(
        (classGroup as { homeroomTeacherId?: mongoose.Types.ObjectId | null }).homeroomTeacherId || ""
      ) === String((teacher as { _id: mongoose.Types.ObjectId })._id) ||
        String(
          (teacher as { homeroomClassGroupId?: mongoose.Types.ObjectId | null }).homeroomClassGroupId ||
            ""
        ) === String(classObjId));

    if (homeroomMatch) {
      return {
        userId: demo.user._id as mongoose.Types.ObjectId,
        schoolId: schoolIdObj,
        mode: "homeroom_teacher",
        teacherId: (teacher as { _id: mongoose.Types.ObjectId })._id,
      };
    }
    throw NextResponse.json(
      { error: "Only a school admin or this class homeroom teacher can edit the timetable." },
      { status: 403 }
    );
  }

  const assisted = await getActiveAssistedAccessSession();
  if (assisted) {
    if (String(assisted.schoolId) !== String(schoolIdObj)) {
      throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return {
      userId: assisted.actorUserId,
      schoolId: schoolIdObj,
      mode: "school_admin",
    };
  }

  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "needs_school_selection") {
      throw NextResponse.json({ error: "School selection required" }, { status: 409 });
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (String(active.context.schoolId) !== String(schoolIdObj)) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = active.context.roles;

  const adminGate = gateSchoolAdminRoles(roles);
  if (adminGate.ok) {
    return {
      userId: active.context.userId,
      schoolId: schoolIdObj,
      mode: "school_admin",
    };
  }

  const teacher = await Teacher.findOne({
    userId: active.context.userId,
    schoolId: schoolIdObj,
  })
    .select("_id homeroomClassGroupId")
    .lean();

  if (!teacher) {
    throw NextResponse.json(
      { error: "Only a school admin or this class homeroom teacher can edit the timetable." },
      { status: 403 }
    );
  }

  const hrOnClass =
    (classGroup as { homeroomTeacherId?: mongoose.Types.ObjectId | null }).homeroomTeacherId &&
    String((classGroup as { homeroomTeacherId: mongoose.Types.ObjectId }).homeroomTeacherId) ===
      String((teacher as { _id: mongoose.Types.ObjectId })._id);

  const hrOnTeacherRecord =
    (teacher as { homeroomClassGroupId?: mongoose.Types.ObjectId | null }).homeroomClassGroupId &&
    String((teacher as { homeroomClassGroupId: mongoose.Types.ObjectId }).homeroomClassGroupId) ===
      String(classObjId);

  if (!hrOnClass && !hrOnTeacherRecord) {
    throw NextResponse.json(
      { error: "Only a school admin or this class homeroom teacher can edit the timetable." },
      { status: 403 }
    );
  }

  return {
    userId: active.context.userId,
    schoolId: schoolIdObj,
    mode: "homeroom_teacher",
    teacherId: (teacher as { _id: mongoose.Types.ObjectId })._id,
  };
}

/**
 * True when the same user may edit/delete a class-group timetable
 * (school admin or this class’s homeroom teacher). For read access use
 * `requireSchoolAdminOrTeacherRead` and call this to decide Edit/Delete UI.
 */
export async function isClassTimetableManagerForReadUser(
  classGroupId: string,
  read: SchoolStaffReadContext
): Promise<boolean> {
  const classObjId = toObjectId(classGroupId);
  if (!classObjId) return false;

  await connectToDatabase();

  const classGroup = await ClassGroup.findById(classObjId)
    .select("_id schoolId homeroomTeacherId")
    .lean();
  if (!classGroup) return false;
  const schoolIdObj = (classGroup as { schoolId: mongoose.Types.ObjectId }).schoolId;
  if (String(schoolIdObj) !== String(read.schoolId)) return false;
  if (read.canBootstrapSchoolSettings) return true;

  const demo = await tryResolveDemoGuard();
  if (demo.isDemo && demo.user.schoolId) {
    if (String(demo.user.schoolId) !== String(schoolIdObj)) return false;
    const roles = (demo.membership.roles || []) as MembershipRole[];
    if (roles.includes("school_admin")) return true;
    const teacher = await Teacher.findOne({
      userId: demo.user._id,
      schoolId: schoolIdObj,
    })
      .select("_id homeroomClassGroupId")
      .lean();
    if (!teacher) return false;
    return (
      String(
        (classGroup as { homeroomTeacherId?: mongoose.Types.ObjectId | null }).homeroomTeacherId || ""
      ) === String((teacher as { _id: mongoose.Types.ObjectId })._id) ||
      String(
        (teacher as { homeroomClassGroupId?: mongoose.Types.ObjectId | null }).homeroomClassGroupId ||
          ""
      ) === String(classObjId)
    );
  }

  if (!read.teacherId) return false;

  const teacher = await Teacher.findById(read.teacherId)
    .select("_id homeroomClassGroupId")
    .lean();
  if (!teacher) return false;

  const hrOnClass =
    (classGroup as { homeroomTeacherId?: mongoose.Types.ObjectId | null }).homeroomTeacherId &&
    String((classGroup as { homeroomTeacherId: mongoose.Types.ObjectId }).homeroomTeacherId) ===
      String((teacher as { _id: mongoose.Types.ObjectId })._id);

  const hrOnTeacherRecord =
    (teacher as { homeroomClassGroupId?: mongoose.Types.ObjectId | null }).homeroomClassGroupId &&
    String((teacher as { homeroomClassGroupId: mongoose.Types.ObjectId }).homeroomClassGroupId) ===
      String(classObjId);

  return Boolean(hrOnClass || hrOnTeacherRecord);
}
