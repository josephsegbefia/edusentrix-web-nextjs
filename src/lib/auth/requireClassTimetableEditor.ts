import "server-only";

import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Teacher } from "@/models/Teacher";
import { User, type IUser } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import type { MembershipRole } from "@/lib/roles";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import type { SchoolStaffReadContext } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";

export type ClassTimetableEditorContext = {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  mode: "school_admin" | "homeroom_teacher";
  /** Present when mode is homeroom_teacher */
  teacherId?: mongoose.Types.ObjectId;
};

function legacyRoleToArray(role?: string): MembershipRole[] {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "teacher") return ["teacher"];
  return ["staff"];
}

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

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<IUser, "_id" | "schoolId" | "role"> | null;
  if (!user?.schoolId) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  if (String(user.schoolId) !== String(schoolIdObj)) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const adminGate = gateSchoolAdminRoles(roles);
  if (adminGate.ok) {
    return {
      userId: user._id as mongoose.Types.ObjectId,
      schoolId: schoolIdObj,
      mode: "school_admin",
    };
  }

  const teacher = await Teacher.findOne({
    userId: user._id,
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
    userId: user._id as mongoose.Types.ObjectId,
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

  let membership = (await UserMembership.findOne({
    userId: read.userId,
    schoolId: read.schoolId,
  }).lean()) as IUserMembership | null;

  if (!membership && read.schoolId) {
    const user = await User.findById(read.userId).lean();
    if (!user?.schoolId) return false;
    membership = (await UserMembership.create({
      userId: read.userId,
      schoolId: read.schoolId,
      roles: legacyRoleToArray((user as Pick<IUser, "role">).role),
      status: "active",
    }).then((d) => d.toObject())) as IUserMembership;
  }

  const roles = (membership?.roles || []) as MembershipRole[];
  if (gateSchoolAdminRoles(roles).ok) return true;

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
