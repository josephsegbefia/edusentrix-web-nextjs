import { SchoolSettings } from "@/models/SchoolSettings";
import { can } from "@/lib/auth/can";
import type { TeacherContext } from "@/lib/auth/requireTeacher";
import type { Permission } from "@/lib/rbac";
import { Types } from "mongoose";

export function isTeacherStudioEnvEnabled() {
  const value = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
  if (value === undefined) return true;
  return value === "true";
}

export async function getTeacherStudioSchoolEnabled(schoolId: Types.ObjectId) {
  const settings = await SchoolSettings.findOne({ schoolId })
    .select("teacherStudio")
    .lean();
  const enabled = (settings as { teacherStudio?: { enabled?: boolean } } | null)?.teacherStudio
    ?.enabled;
  return enabled ?? true;
}

export async function getTeacherStudioEnabledForSchool(schoolId: Types.ObjectId) {
  if (!isTeacherStudioEnvEnabled()) return false;
  return getTeacherStudioSchoolEnabled(schoolId);
}

export async function requireTeacherStudioFeature(schoolId: Types.ObjectId) {
  if (!isTeacherStudioEnvEnabled()) {
    throw Response.json(
      { success: false, error: "Teacher Studio is disabled" },
      { status: 403 }
    );
  }
  const enabled = await getTeacherStudioSchoolEnabled(schoolId);
  if (!enabled) {
    throw Response.json(
      { success: false, error: "Teacher Studio is disabled" },
      { status: 403 }
    );
  }
}

export async function requireTeacherStudioAccess(
  context: TeacherContext,
  permission?: Permission
) {
  await requireTeacherStudioFeature(context.schoolId);
  if (permission && !can(context.permissions, permission)) {
    throw Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
}
