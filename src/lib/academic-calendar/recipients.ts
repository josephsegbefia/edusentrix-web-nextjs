import { Types } from "mongoose";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { UserMembership } from "@/models/UserMembership";
import {
  type CalendarAudience,
  DEFAULT_AUDIENCE_ROLES,
} from "@/lib/academic-calendar/types";

export type CalendarRecipient = {
  userId: Types.ObjectId;
  wardId?: Types.ObjectId;
  role: "parent" | "teacher" | "student" | "staff" | "bursar";
};

const periodCache = new Map<string, Types.ObjectId | null>();

async function getCurrentPeriodId(schoolId: Types.ObjectId) {
  const key = String(schoolId);
  if (periodCache.has(key)) return periodCache.get(key) || null;

  const current = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("_id")
    .lean();

  const id = current?._id ? new Types.ObjectId(String(current._id)) : null;
  periodCache.set(key, id);
  return id;
}

function normalizeRoles(roles?: string[]) {
  if (!roles || roles.length === 0) return [...DEFAULT_AUDIENCE_ROLES];
  return roles;
}

async function resolveSpecificUserRecipients(input: {
  schoolId: Types.ObjectId;
  audience: CalendarAudience;
}) {
  const { schoolId, audience } = input;
  if (audience.scope !== "specific_users" || !audience.userIds?.length) {
    return [] as CalendarRecipient[];
  }

  const userIds = Array.from(
    new Set(
      audience.userIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => String(id))
    )
  ).map((id) => new Types.ObjectId(id));

  if (userIds.length === 0) return [] as CalendarRecipient[];

  const memberships = await UserMembership.find({
    schoolId,
    userId: { $in: userIds },
    status: "active",
  })
    .select("userId roles")
    .lean();

  return memberships.map((membership) => {
    const roles = ((membership as { roles?: string[] }).roles || []).map(String);
    let role: CalendarRecipient["role"] = "staff";

    if (roles.includes("parent")) role = "parent";
    else if (roles.includes("teacher")) role = "teacher";
    else if (roles.includes("student")) role = "student";
    else if (roles.includes("bursar")) role = "bursar";

    return {
      userId: (membership as { userId: Types.ObjectId }).userId,
      role,
    };
  });
}

async function resolveParentRecipients(input: {
  schoolId: Types.ObjectId;
  audience: CalendarAudience;
}) {
  const { schoolId, audience } = input;

  const studentQuery: Record<string, unknown> = { schoolId };
  if (audience.scope === "grades" && audience.gradeIds?.length) {
    studentQuery.gradeId = { $in: audience.gradeIds.map((id) => new Types.ObjectId(id)) };
  }
  if (audience.scope === "classes" && audience.classGroupIds?.length) {
    studentQuery.classGroupId = {
      $in: audience.classGroupIds.map((id) => new Types.ObjectId(id)),
    };
  }

  const students = await Student.find(studentQuery)
    .select("_id")
    .lean();

  if (students.length === 0) return [] as CalendarRecipient[];

  const studentIds = students.map((s) => (s as { _id: Types.ObjectId })._id);

  const guardians = await Guardian.find({ studentId: { $in: studentIds } })
    .select("userId studentId")
    .lean();

  return guardians.map((g) => ({
    userId: (g as { userId: Types.ObjectId }).userId,
    wardId: (g as { studentId: Types.ObjectId }).studentId,
    role: "parent" as const,
  }));
}

async function resolveTeacherRecipients(input: {
  schoolId: Types.ObjectId;
  audience: CalendarAudience;
  academicPeriodId?: Types.ObjectId | null;
}) {
  const { schoolId, audience } = input;
  let classGroupIds: Types.ObjectId[] | null = null;

  if (audience.scope === "classes" && audience.classGroupIds?.length) {
    classGroupIds = audience.classGroupIds.map((id) => new Types.ObjectId(id));
  }

  if (audience.scope === "grades" && audience.gradeIds?.length) {
    const groups = await ClassGroup.find({
      schoolId,
      gradeId: { $in: audience.gradeIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id")
      .lean();

    classGroupIds = groups.map((g) => (g as { _id: Types.ObjectId })._id);
  }

  if (!classGroupIds || classGroupIds.length === 0) {
    const teachers = await Teacher.find({ schoolId, status: "active" })
      .select("userId")
      .lean();
    return teachers.map((t) => ({
      userId: (t as { userId: Types.ObjectId }).userId,
      role: "teacher" as const,
    }));
  }

  const periodId = input.academicPeriodId || (await getCurrentPeriodId(schoolId));

  const assignments = await TeacherAssignment.find({
    schoolId,
    classGroupId: { $in: classGroupIds },
    status: "active",
    ...(periodId ? { academicPeriodId: periodId } : {}),
  })
    .select("teacherId")
    .lean();

  const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
    .select("homeroomTeacherId")
    .lean();

  const teacherIds = new Set<string>();
  assignments.forEach((a) => teacherIds.add(String((a as { teacherId: Types.ObjectId }).teacherId)));
  classGroups.forEach((g) => {
    const homeroom = (g as { homeroomTeacherId?: Types.ObjectId | null }).homeroomTeacherId;
    if (homeroom) teacherIds.add(String(homeroom));
  });

  if (teacherIds.size === 0) return [] as CalendarRecipient[];

  const teachers = await Teacher.find({ _id: { $in: Array.from(teacherIds).map((id) => new Types.ObjectId(id)) } })
    .select("userId")
    .lean();

  return teachers.map((t) => ({
    userId: (t as { userId: Types.ObjectId }).userId,
    role: "teacher" as const,
  }));
}

export async function resolveAudienceRecipients(input: {
  schoolId: Types.ObjectId;
  audience: CalendarAudience;
  academicPeriodId?: Types.ObjectId | null;
}) {
  const { schoolId, audience } = input;
  const roles = normalizeRoles(audience.roles);

  const recipients: CalendarRecipient[] = [];

  if (audience.scope === "specific_users") {
    recipients.push(
      ...(
        await resolveSpecificUserRecipients({
          schoolId,
          audience,
        })
      ).filter((recipient) => roles.includes(recipient.role))
    );
  }

  if (audience.scope !== "specific_users" && roles.includes("parent")) {
    recipients.push(
      ...(await resolveParentRecipients({ schoolId, audience }))
    );
  }

  if (audience.scope !== "specific_users" && roles.includes("teacher")) {
    recipients.push(
      ...(await resolveTeacherRecipients({
        schoolId,
        audience,
        academicPeriodId: input.academicPeriodId,
      }))
    );
  }

  const unique = new Map<string, CalendarRecipient>();
  recipients.forEach((r) => {
    const key = `${String(r.userId)}:${String(r.wardId || "")}`;
    if (!unique.has(key)) unique.set(key, r);
  });

  return Array.from(unique.values());
}
