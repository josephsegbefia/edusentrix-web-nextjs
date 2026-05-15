import { Types } from "mongoose";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import type {
  CommunicationAudienceRule,
  CommunicationRecipientRole,
  ResolvedCommunicationRecipient,
} from "@/lib/communications/types";

type ResolveAudienceInput = {
  schoolId: Types.ObjectId;
  audience: CommunicationAudienceRule;
};

type UserLike = {
  _id: Types.ObjectId;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: string | null;
};

type StudentLike = {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | null;
  firstName: string;
  lastName: string;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
};

const STAFF_ROLES = ["school_admin", "billing_owner", "bursar", "staff"] as const;

function objectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  return null;
}

function displayName(user?: UserLike | null, fallback?: string | null) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return user?.name || parts || fallback || user?.email || "Recipient";
}

function studentName(student: StudentLike) {
  return [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
}

function userRecipient(
  user: UserLike,
  role: CommunicationRecipientRole,
  reasonIncluded: string,
): ResolvedCommunicationRecipient {
  return {
    key: `user:${String(user._id)}`,
    userId: user._id,
    role,
    name: displayName(user),
    email: user.email ?? null,
    phone: user.phone ?? null,
    whatsappPhone: user.phone ?? null,
    reasonIncluded,
  };
}

function normalizeRecipientRole(role?: string | null): CommunicationRecipientRole {
  if (role === "parent") return "parent";
  if (role === "student") return "student";
  if (role === "teacher") return "teacher";
  if (role === "school_admin") return "school_admin";
  if (role === "bursar") return "bursar";
  if (role === "staff" || role === "billing_owner") return "staff";
  return "external";
}

function dedupeRecipients(recipients: ResolvedCommunicationRecipient[]) {
  const map = new Map<string, ResolvedCommunicationRecipient>();
  for (const recipient of recipients) {
    const key =
      recipient.userId ? `user:${String(recipient.userId)}` :
      recipient.email ? `email:${recipient.email.toLowerCase()}` :
      recipient.phone ? `phone:${recipient.phone}` :
      recipient.key;
    if (!map.has(key)) map.set(key, { ...recipient, key });
  }
  return Array.from(map.values());
}

async function findStudentsForAudience(schoolId: Types.ObjectId, audience: CommunicationAudienceRule) {
  const query: Record<string, unknown> = { schoolId, status: "active" };
  if (audience.type === "grades" && audience.gradeIds?.length) {
    query.gradeId = { $in: audience.gradeIds.map(objectId).filter(Boolean) };
  }
  if (audience.type === "class_groups" && audience.classGroupIds?.length) {
    query.classGroupId = { $in: audience.classGroupIds.map(objectId).filter(Boolean) };
  }
  return Student.find(query)
    .select("_id userId firstName lastName gradeId classGroupId")
    .lean<StudentLike[]>();
}

async function resolveParentRecipients(
  schoolId: Types.ObjectId,
  audience: CommunicationAudienceRule,
  reasonIncluded: string,
) {
  const students = await findStudentsForAudience(schoolId, audience);
  const studentMap = new Map(students.map((student) => [String(student._id), student]));
  if (!students.length) return [];

  const guardians = await Guardian.find({ studentId: { $in: students.map((student) => student._id) } })
    .select("_id studentId userId email phone relationship")
    .lean<Array<{
      _id: Types.ObjectId;
      studentId: Types.ObjectId;
      userId: Types.ObjectId;
      email?: string | null;
      phone?: string | null;
    }>>();
  const users = await User.find({ _id: { $in: guardians.map((guardian) => guardian.userId) } })
    .select("_id email name firstName lastName phone role")
    .lean<UserLike[]>();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return guardians.map<ResolvedCommunicationRecipient>((guardian) => {
    const student = studentMap.get(String(guardian.studentId));
    const user = userMap.get(String(guardian.userId));
    return {
      key: `guardian:${String(guardian._id)}:${String(student?._id ?? "")}`,
      userId: guardian.userId,
      studentId: guardian.studentId,
      guardianId: guardian._id,
      role: "parent",
      name: displayName(user, guardian.email),
      email: guardian.email || user?.email || null,
      phone: guardian.phone || user?.phone || null,
      whatsappPhone: guardian.phone || user?.phone || null,
      gradeId: student?.gradeId ?? null,
      classGroupId: student?.classGroupId ?? null,
      reasonIncluded: `${reasonIncluded}${student ? ` for ${studentName(student)}` : ""}`,
    };
  });
}

async function resolveStudentRecipients(schoolId: Types.ObjectId, audience: CommunicationAudienceRule) {
  const students = await findStudentsForAudience(schoolId, audience);
  const linkedStudents = students.filter((student) => student.userId);
  const users = await User.find({ _id: { $in: linkedStudents.map((student) => student.userId) } })
    .select("_id email name firstName lastName phone role")
    .lean<UserLike[]>();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return linkedStudents.map<ResolvedCommunicationRecipient>((student) => {
    const user = userMap.get(String(student.userId));
    return {
      key: `student:${String(student._id)}`,
      userId: student.userId ?? null,
      studentId: student._id,
      role: "student",
      name: displayName(user, studentName(student)),
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      whatsappPhone: user?.phone ?? null,
      gradeId: student.gradeId ?? null,
      classGroupId: student.classGroupId ?? null,
      reasonIncluded: "Active student in selected audience",
    };
  });
}

async function resolveTeacherRecipients(schoolId: Types.ObjectId) {
  const teachers = await Teacher.find({ schoolId, status: { $ne: "terminated" } })
    .select("_id userId")
    .lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId }>>();
  const users = await User.find({ _id: { $in: teachers.map((teacher) => teacher.userId) } })
    .select("_id email name firstName lastName phone role")
    .lean<UserLike[]>();
  return users.map((user) => userRecipient(user, "teacher", "Active teacher"));
}

async function resolveStaffRecipients(schoolId: Types.ObjectId) {
  const users = await User.find({ schoolId, role: { $in: STAFF_ROLES } })
    .select("_id email name firstName lastName phone role")
    .lean<UserLike[]>();
  return users.map((user) =>
    userRecipient(user, user.role === "bursar" ? "bursar" : user.role === "school_admin" ? "school_admin" : "staff", "School staff"),
  );
}

export async function resolveCommunicationAudience(input: ResolveAudienceInput) {
  const { schoolId, audience } = input;
  const recipients: ResolvedCommunicationRecipient[] = [];

  if (audience.type === "entire_school") {
    recipients.push(...(await resolveParentRecipients(schoolId, { type: "parents" }, "Parent in school")));
    recipients.push(...(await resolveStudentRecipients(schoolId, { type: "students" })));
    recipients.push(...(await resolveTeacherRecipients(schoolId)));
    recipients.push(...(await resolveStaffRecipients(schoolId)));
  } else if (audience.type === "parents") {
    recipients.push(...(await resolveParentRecipients(schoolId, audience, "Parent in selected audience")));
  } else if (audience.type === "students") {
    recipients.push(...(await resolveStudentRecipients(schoolId, audience)));
  } else if (audience.type === "teachers") {
    recipients.push(...(await resolveTeacherRecipients(schoolId)));
  } else if (audience.type === "staff") {
    recipients.push(...(await resolveStaffRecipients(schoolId)));
  } else if (audience.type === "grades" || audience.type === "class_groups") {
    const roles = audience.targetRoles?.length ? audience.targetRoles : ["parent"];
    if (roles.includes("parent")) {
      recipients.push(...(await resolveParentRecipients(schoolId, audience, "Parent in selected grade or class")));
    }
    if (roles.includes("student")) {
      recipients.push(...(await resolveStudentRecipients(schoolId, audience)));
    }
  } else if (audience.type === "custom_users" && audience.userIds?.length) {
    const requestedUserIds = audience.userIds.map(objectId).filter(Boolean);
    const schoolStudents = await Student.find({ schoolId, status: "active" })
      .select("_id")
      .lean<Array<{ _id: Types.ObjectId }>>();
    const schoolGuardians = await Guardian.find({
      studentId: { $in: schoolStudents.map((student) => student._id) },
      userId: { $in: requestedUserIds },
    })
      .select("userId")
      .lean<Array<{ userId: Types.ObjectId }>>();
    const linkedGuardianUserIds = new Set(schoolGuardians.map((guardian) => String(guardian.userId)));
    const users = await User.find({
      _id: { $in: requestedUserIds },
      $or: [
        { schoolId },
        { _id: { $in: Array.from(linkedGuardianUserIds).map((id) => new Types.ObjectId(id)) } },
      ],
    })
      .select("_id email name firstName lastName phone role")
      .lean<UserLike[]>();
    recipients.push(
      ...users.map((user) => userRecipient(user, normalizeRecipientRole(user.role), "Custom selected user")),
    );
  } else if (audience.type === "custom_contacts") {
    recipients.push(
      ...(audience.externalContacts ?? []).map((contact, index) => ({
        key: `external:${index}:${contact.email || contact.phone || contact.whatsappPhone || "contact"}`,
        role: contact.role ?? "external",
        name: contact.name || contact.email || contact.phone || "External contact",
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        whatsappPhone: contact.whatsappPhone ?? contact.phone ?? null,
        reasonIncluded: "Custom external contact",
      })),
    );
  }

  const deduped = dedupeRecipients(recipients);
  return {
    recipients: deduped,
    summary: {
      total: deduped.length,
      inApp: deduped.filter((recipient) => recipient.userId).length,
      email: deduped.filter((recipient) => recipient.email).length,
      whatsapp: deduped.filter((recipient) => recipient.whatsappPhone).length,
      sms: deduped.filter((recipient) => recipient.phone).length,
      missingContact: deduped.filter(
        (recipient) => !recipient.userId && !recipient.email && !recipient.phone && !recipient.whatsappPhone,
      ).length,
    },
  };
}
