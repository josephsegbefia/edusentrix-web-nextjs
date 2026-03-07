import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { MessageThread } from "@/models/MessageThread";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

type RecipientRole = "teacher" | "school_admin" | "bursar" | "staff";
type RecipientCategory =
  | "homeroom_teacher"
  | "teacher"
  | "school_admin"
  | "bursar"
  | "staff"
  | "recent";

type Recipient = {
  id: string;
  name: string;
  role: RecipientRole;
  photoUrl: string | null;
  wardId: string | null;
  wardName: string | null;
  subtitle?: string;
  category: RecipientCategory;
  isHomeroom?: boolean;
};

type GuardianRow = {
  studentId: mongoose.Types.ObjectId;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  classGroupId?: mongoose.Types.ObjectId | null;
};

type ClassGroupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  gradeId?: mongoose.Types.ObjectId | null;
  homeroomTeacherId?: mongoose.Types.ObjectId | null;
};

type GradeRow = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
};

type AcademicPeriodRow = {
  _id: mongoose.Types.ObjectId;
};

type TeacherAssignmentRow = {
  teacherId?: mongoose.Types.ObjectId | null;
  classGroupId?: mongoose.Types.ObjectId | null;
  subjectId?: mongoose.Types.ObjectId | null;
};

type TeacherRow = {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
};

type SubjectRow = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  shortCode?: string | null;
};

type UserRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  role?: string | null;
};

type UserMembershipRow = {
  userId?: mongoose.Types.ObjectId | null;
  roles?: string[] | null;
};

type ThreadParticipant = {
  userId: mongoose.Types.ObjectId;
  role: string;
};

type MessageThreadRow = {
  studentId?: mongoose.Types.ObjectId | null;
  subject?: string;
  participants: ThreadParticipant[];
};

const categoryRank: Record<RecipientCategory, number> = {
  homeroom_teacher: 0,
  teacher: 1,
  school_admin: 2,
  bursar: 3,
  staff: 4,
  recent: 5,
};

function getFullName(value: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  const fullName = `${value.firstName || ""} ${value.lastName || ""}`.trim();
  if (fullName) return fullName;
  if (value.name?.trim()) return value.name.trim();
  if (value.email?.trim()) return value.email.trim();
  return "School Contact";
}

function normalizeOfficeRole(roles: Iterable<string>): RecipientRole | null {
  const roleSet = new Set<string>();
  for (const role of roles) roleSet.add(role);

  if (roleSet.has("school_admin")) return "school_admin";
  if (roleSet.has("bursar")) return "bursar";
  if (roleSet.has("staff")) return "staff";
  return null;
}

function normalizeThreadRole(value: unknown): RecipientRole | null {
  if (typeof value !== "string") return null;
  if (value === "teacher") return "teacher";
  if (value === "school_admin") return "school_admin";
  if (value === "bursar") return "bursar";
  if (value === "staff") return "staff";
  return null;
}

function categoryFromRole(role: RecipientRole): RecipientCategory {
  if (role === "school_admin") return "school_admin";
  if (role === "bursar") return "bursar";
  if (role === "staff") return "staff";
  return "teacher";
}

function classLabel(gradeName?: string | null, classGroupName?: string | null) {
  const grade = gradeName?.trim();
  const group = classGroupName?.trim();
  if (grade && group) return `${grade} ${group}`;
  return grade || group || null;
}

function subjectLabel(subject?: SubjectRow | null) {
  const shortCode = subject?.shortCode?.trim();
  if (shortCode) return shortCode;
  const name = subject?.name?.trim();
  if (name) return name;
  return "Subject";
}

function sortRecipients(a: Recipient, b: Recipient) {
  const rankDiff = categoryRank[a.category] - categoryRank[b.category];
  if (rankDiff !== 0) return rankDiff;
  return a.name.localeCompare(b.name);
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const wardId = req.nextUrl.searchParams.get("wardId");
    if (wardId && !mongoose.Types.ObjectId.isValid(wardId)) {
      return NextResponse.json(
        { success: false, error: "Invalid wardId" },
        { status: 400 }
      );
    }

    const wardObjectId = wardId ? new mongoose.Types.ObjectId(wardId) : null;

    const guardianQuery: Record<string, unknown> = { userId: context.userId };
    if (wardObjectId) guardianQuery.studentId = wardObjectId;

    const guardians = await Guardian.find(guardianQuery)
      .select("studentId")
      .lean<GuardianRow[]>();

    if (wardObjectId && guardians.length === 0) {
      return NextResponse.json(
        { success: false, error: "You don't have access to this student" },
        { status: 403 }
      );
    }

    if (guardians.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recipients: [],
          homeroomTeachers: [],
          teachers: [],
          schoolAdmins: [],
          bursars: [],
          staff: [],
          recent: [],
        },
      });
    }

    const wardIds = Array.from(
      new Set(guardians.map((link) => String(link.studentId)))
    ).map((id) => new mongoose.Types.ObjectId(id));

    const students = await Student.find({
      _id: { $in: wardIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName classGroupId")
      .lean<StudentRow[]>();

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recipients: [],
          homeroomTeachers: [],
          teachers: [],
          schoolAdmins: [],
          bursars: [],
          staff: [],
          recent: [],
        },
      });
    }

    const wardById = new Map(
      students.map((student) => [
        String(student._id),
        `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student",
      ])
    );

    const classGroupIds = students
      .map((student) => student.classGroupId)
      .filter(
        (classGroupId): classGroupId is mongoose.Types.ObjectId => Boolean(classGroupId)
      );

    const classGroups = await ClassGroup.find({
      _id: { $in: classGroupIds },
      schoolId: context.schoolId,
    })
      .select("_id name gradeId homeroomTeacherId")
      .lean<ClassGroupRow[]>();

    const gradeIds = classGroups
      .map((classGroup) => classGroup.gradeId)
      .filter((gradeId): gradeId is mongoose.Types.ObjectId => Boolean(gradeId));

    const grades = await Grade.find({ _id: { $in: gradeIds } })
      .select("_id name")
      .lean<GradeRow[]>();

    const gradeNameById = new Map(
      grades.map((grade) => [String(grade._id), grade.name || ""])
    );

    const classMetaById = new Map(
      classGroups.map((classGroup) => [
        String(classGroup._id),
        {
          label: classLabel(
            classGroup.gradeId ? gradeNameById.get(String(classGroup.gradeId)) : null,
            classGroup.name
          ),
          homeroomTeacherId: classGroup.homeroomTeacherId
            ? String(classGroup.homeroomTeacherId)
            : null,
        },
      ])
    );

    const wardByClassGroup = new Map<
      string,
      { id: string; name: string }
    >();
    students.forEach((student) => {
      if (!student.classGroupId) return;
      const classGroupId = String(student.classGroupId);
      if (wardByClassGroup.has(classGroupId)) return;
      wardByClassGroup.set(classGroupId, {
        id: String(student._id),
        name: wardById.get(String(student._id)) || "Student",
      });
    });

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean<AcademicPeriodRow | null>();

    const assignmentQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      classGroupId: { $in: classGroupIds },
      status: "active",
    };
    if (currentPeriod?._id) {
      assignmentQuery.academicPeriodId = currentPeriod._id;
    }

    let assignments = await TeacherAssignment.find(assignmentQuery)
      .select("teacherId classGroupId subjectId")
      .lean<TeacherAssignmentRow[]>();

    if (assignments.length === 0 && currentPeriod?._id) {
      const fallbackQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        classGroupId: { $in: classGroupIds },
        status: "active",
      };
      assignments = await TeacherAssignment.find(fallbackQuery)
        .select("teacherId classGroupId subjectId")
        .lean<TeacherAssignmentRow[]>();
    }

    const teacherIds = new Set<string>();
    assignments.forEach((assignment) => {
      if (assignment.teacherId) teacherIds.add(String(assignment.teacherId));
    });
    classGroups.forEach((classGroup) => {
      if (classGroup.homeroomTeacherId) {
        teacherIds.add(String(classGroup.homeroomTeacherId));
      }
    });

    const teachers = await Teacher.find({
      _id: { $in: Array.from(teacherIds).map((id) => new mongoose.Types.ObjectId(id)) },
      schoolId: context.schoolId,
      status: { $in: ["active", "on_leave"] },
    })
      .select("_id userId")
      .lean<TeacherRow[]>();

    const teacherById = new Map(
      teachers.map((teacher) => [String(teacher._id), teacher])
    );

    const subjectIds = assignments
      .map((assignment) => assignment.subjectId)
      .filter((subjectId): subjectId is mongoose.Types.ObjectId => Boolean(subjectId));

    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select("_id name shortCode")
      .lean<SubjectRow[]>();

    const subjectById = new Map(
      subjects.map((subject) => [String(subject._id), subject])
    );

    const officeMemberships = await UserMembership.find({
      schoolId: context.schoolId,
      status: "active",
      roles: { $in: ["school_admin", "bursar", "staff"] },
      userId: { $ne: context.userId },
    })
      .select("userId roles")
      .lean<UserMembershipRow[]>();

    const legacyOfficeUsers = await User.find({
      schoolId: context.schoolId,
      role: { $in: ["school_admin", "bursar", "staff"] },
      _id: { $ne: context.userId },
    })
      .select("_id firstName lastName name email avatarUrl photoUrl role")
      .lean<UserRow[]>();

    const recentThreadQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      "participants.userId": context.userId,
      studentId: wardObjectId ? wardObjectId : { $in: students.map((student) => student._id) },
    };

    const recentThreads = await MessageThread.find(recentThreadQuery)
      .select("participants studentId subject")
      .sort({ lastMessageAt: -1 })
      .limit(24)
      .lean<MessageThreadRow[]>();

    const userIds = new Set<string>();
    teachers.forEach((teacher) => {
      if (teacher.userId) userIds.add(String(teacher.userId));
    });
    officeMemberships.forEach((membership) => {
      if (membership.userId) userIds.add(String(membership.userId));
    });
    legacyOfficeUsers.forEach((user) => userIds.add(String(user._id)));
    recentThreads.forEach((thread) => {
      thread.participants.forEach((participant) => {
        if (String(participant.userId) !== String(context.userId)) {
          userIds.add(String(participant.userId));
        }
      });
    });

    const users = await User.find({
      _id: { $in: Array.from(userIds).map((id) => new mongoose.Types.ObjectId(id)) },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName name email avatarUrl photoUrl role")
      .lean<UserRow[]>();

    const userById = new Map<string, UserRow>();
    users.forEach((user) => userById.set(String(user._id), user));
    legacyOfficeUsers.forEach((user) => {
      const id = String(user._id);
      if (!userById.has(id)) {
        userById.set(id, user);
      }
    });

    const recipients = new Map<string, Recipient>();

    const upsertRecipient = (candidate: Recipient) => {
      const existing = recipients.get(candidate.id);
      if (!existing) {
        recipients.set(candidate.id, candidate);
        return;
      }

      if (categoryRank[candidate.category] < categoryRank[existing.category]) {
        recipients.set(candidate.id, candidate);
        return;
      }

      const merged: Recipient = {
        ...existing,
        subtitle: existing.subtitle || candidate.subtitle,
        wardId: existing.wardId || candidate.wardId,
        wardName: existing.wardName || candidate.wardName,
        photoUrl: existing.photoUrl || candidate.photoUrl,
      };
      recipients.set(candidate.id, merged);
    };

    classGroups.forEach((classGroup) => {
      if (!classGroup.homeroomTeacherId) return;

      const teacher = teacherById.get(String(classGroup.homeroomTeacherId));
      const user = teacher?.userId
        ? userById.get(String(teacher.userId))
        : undefined;
      if (!teacher || !teacher.userId || !user) return;

      const classGroupId = String(classGroup._id);
      const wardInfo = wardByClassGroup.get(classGroupId);
      const classInfo = classMetaById.get(classGroupId);

      upsertRecipient({
        id: String(user._id),
        name: getFullName(user),
        role: "teacher",
        photoUrl: user.avatarUrl || user.photoUrl || null,
        wardId: wardInfo?.id || null,
        wardName: wardInfo?.name || null,
        subtitle: classInfo?.label ? `Homeroom • ${classInfo.label}` : "Homeroom Teacher",
        category: "homeroom_teacher",
        isHomeroom: true,
      });
    });

    assignments.forEach((assignment) => {
      if (!assignment.teacherId || !assignment.classGroupId) return;
      const teacher = teacherById.get(String(assignment.teacherId));
      const user = teacher?.userId
        ? userById.get(String(teacher.userId))
        : undefined;
      if (!teacher || !teacher.userId || !user) return;

      const classGroupId = String(assignment.classGroupId);
      const classInfo = classMetaById.get(classGroupId);
      const wardInfo = wardByClassGroup.get(classGroupId);
      const subject = assignment.subjectId
        ? subjectById.get(String(assignment.subjectId))
        : null;
      const subtitleParts = [subjectLabel(subject), classInfo?.label].filter(Boolean);

      upsertRecipient({
        id: String(user._id),
        name: getFullName(user),
        role: "teacher",
        photoUrl: user.avatarUrl || user.photoUrl || null,
        wardId: wardInfo?.id || null,
        wardName: wardInfo?.name || null,
        subtitle: subtitleParts.join(" • "),
        category: "teacher",
      });
    });

    const officeRoleByUserId = new Map<string, RecipientRole>();
    officeMemberships.forEach((membership) => {
      if (!membership.userId) return;
      const role = normalizeOfficeRole(membership.roles || []);
      if (!role) return;
      officeRoleByUserId.set(String(membership.userId), role);
    });

    legacyOfficeUsers.forEach((user) => {
      const id = String(user._id);
      if (officeRoleByUserId.has(id)) return;
      const role = normalizeOfficeRole([user.role || ""]);
      if (!role) return;
      officeRoleByUserId.set(id, role);
    });

    officeRoleByUserId.forEach((role, userId) => {
      const user = userById.get(userId);
      if (!user) return;
      const category = categoryFromRole(role);
      upsertRecipient({
        id: userId,
        name: getFullName(user),
        role,
        photoUrl: user.avatarUrl || user.photoUrl || null,
        wardId: null,
        wardName: null,
        subtitle: "School Office",
        category,
      });
    });

    recentThreads.forEach((thread) => {
      const wardRefId = thread.studentId ? String(thread.studentId) : null;
      const wardName = wardRefId ? wardById.get(wardRefId) || null : null;
      thread.participants.forEach((participant) => {
        if (String(participant.userId) === String(context.userId)) return;

        const role = normalizeThreadRole(participant.role);
        if (!role) return;

        const user = userById.get(String(participant.userId));
        if (!user) return;

        upsertRecipient({
          id: String(user._id),
          name: getFullName(user),
          role,
          photoUrl: user.avatarUrl || user.photoUrl || null,
          wardId: wardRefId,
          wardName,
          subtitle: thread.subject?.trim() || undefined,
          category: "recent",
        });
      });
    });

    const allRecipients = Array.from(recipients.values()).sort(sortRecipients);
    const homeroomTeachers = allRecipients.filter(
      (recipient) => recipient.category === "homeroom_teacher"
    );
    const teachersList = allRecipients.filter(
      (recipient) => recipient.category === "teacher"
    );
    const schoolAdmins = allRecipients.filter(
      (recipient) => recipient.category === "school_admin"
    );
    const bursars = allRecipients.filter(
      (recipient) => recipient.category === "bursar"
    );
    const staff = allRecipients.filter(
      (recipient) => recipient.category === "staff"
    );
    const recent = allRecipients.filter(
      (recipient) => recipient.category === "recent"
    );

    return NextResponse.json({
      success: true,
      data: {
        recipients: allRecipients,
        homeroomTeachers,
        teachers: teachersList,
        schoolAdmins,
        bursars,
        staff,
        recent,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to load parent message recipients:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load recipients",
      },
      { status: 500 }
    );
  }
}
