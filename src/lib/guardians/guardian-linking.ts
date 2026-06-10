import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian, type GuardianRelationship } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

export type GuardianDto = {
  id: string;
  userId: string;
  fullName: string;
  relationship: GuardianRelationship;
  phone: string;
  email: string;
  occupation: string | null;
  photoUrl: string | null;
  isPrimary: boolean;
  createdAt: string;
  hasPlatformAccount: boolean;
};

export type GuardianSiblingCandidateDto = {
  studentId: string;
  studentName: string;
  gradeName: string | null;
  classGroupName: string | null;
  relationship: GuardianRelationship;
  isPrimary: boolean;
};

function buildFullName(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return user.name?.trim() || composed || user.email || "Parent";
}

export function normalizePhoneForSearch(phone: string | null | undefined) {
  return (phone || "").replace(/[^\d+]/g, "").trim();
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatGuardianDto(guardian: {
  _id: mongoose.Types.ObjectId;
  userId:
    | mongoose.Types.ObjectId
    | {
        _id: mongoose.Types.ObjectId;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        avatarUrl?: string | null;
        clerkUserId?: string | null;
      };
  relationship: GuardianRelationship;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  photoUrl?: string | null;
  isPrimary: boolean;
  createdAt: Date;
}): GuardianDto {
  const user =
    guardian.userId instanceof mongoose.Types.ObjectId
      ? null
      : guardian.userId;
  const userId =
    guardian.userId instanceof mongoose.Types.ObjectId
      ? guardian.userId
      : guardian.userId._id;

  return {
    id: String(guardian._id),
    userId: String(userId),
    fullName: user ? buildFullName(user) : "Parent",
    relationship: guardian.relationship,
    phone: guardian.phone || "",
    email: guardian.email || user?.email || "",
    occupation: guardian.occupation || null,
    photoUrl: guardian.photoUrl || user?.avatarUrl || null,
    isPrimary: guardian.isPrimary,
    createdAt: guardian.createdAt.toISOString(),
    hasPlatformAccount: Boolean(user?.clerkUserId),
  };
}

export async function getGuardianSiblingCandidates(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}): Promise<GuardianSiblingCandidateDto[]> {
  const schoolStudentIds = await Student.find({
    schoolId: input.schoolId,
    _id: { $ne: input.studentId },
  })
    .select("_id")
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  if (!schoolStudentIds.length) return [];

  const siblingGuardianRows = await Guardian.find({
    userId: input.userId,
    studentId: { $in: schoolStudentIds.map((row) => row._id) },
  })
    .select("studentId relationship isPrimary")
    .lean<
      Array<{
        studentId: mongoose.Types.ObjectId;
        relationship: GuardianRelationship;
        isPrimary: boolean;
      }>
    >();

  if (!siblingGuardianRows.length) return [];

  const students = await Student.find({
    schoolId: input.schoolId,
    _id: { $in: siblingGuardianRows.map((row) => row.studentId) },
  })
    .select("_id firstName middleName lastName gradeId classGroupId")
    .lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        firstName: string;
        middleName?: string | null;
        lastName: string;
        gradeId: mongoose.Types.ObjectId;
        classGroupId: mongoose.Types.ObjectId;
      }>
    >();

  const gradeIds = Array.from(new Set(students.map((student) => String(student.gradeId)))).map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const classGroupIds = Array.from(
    new Set(students.map((student) => String(student.classGroupId)))
  ).map((id) => new mongoose.Types.ObjectId(id));

  const [grades, classGroups] = await Promise.all([
    Grade.find({ _id: { $in: gradeIds }, schoolId: input.schoolId })
      .select("_id name")
      .lean<Array<{ _id: mongoose.Types.ObjectId; name: string }>>(),
    ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: input.schoolId })
      .select("_id name")
      .lean<Array<{ _id: mongoose.Types.ObjectId; name: string }>>(),
  ]);

  const studentMap = new Map(students.map((student) => [String(student._id), student]));
  const gradeMap = new Map(grades.map((grade) => [String(grade._id), grade.name]));
  const classMap = new Map(classGroups.map((classGroup) => [String(classGroup._id), classGroup.name]));

  return siblingGuardianRows
    .map((row) => {
      const student = studentMap.get(String(row.studentId));
      if (!student) return null;
      return {
        studentId: String(student._id),
        studentName: [student.firstName, student.middleName, student.lastName]
          .filter(Boolean)
          .join(" "),
        gradeName: gradeMap.get(String(student.gradeId)) || null,
        classGroupName: classMap.get(String(student.classGroupId)) || null,
        relationship: row.relationship,
        isPrimary: row.isPrimary,
      };
    })
    .filter(Boolean) as GuardianSiblingCandidateDto[];
}

export async function searchExistingGuardiansForStudent(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  query: string;
  limit?: number;
}) {
  const search = input.query.trim();
  if (search.length < 2) return [];

  const students = await Student.find({ schoolId: input.schoolId })
    .select("_id")
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  if (!students.length) return [];

  const studentIds = students.map((student) => student._id);
  const regex = new RegExp(escapeRegex(search), "i");
  const phoneSearch = normalizePhoneForSearch(search);

  const matchingUsers = await User.find({
    $or: [
      { email: regex },
      { firstName: regex },
      { lastName: regex },
      { name: regex },
      ...(phoneSearch ? [{ phone: new RegExp(escapeRegex(phoneSearch), "i") }] : []),
    ],
  })
    .select("_id")
    .limit(50)
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  const userIds = matchingUsers.map((user) => user._id);
  const guardianMatches = await Guardian.find({
    studentId: { $in: studentIds },
    $or: [
      { email: regex },
      { phone: regex },
      ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
    ],
  })
    .populate("userId", "name firstName lastName email phone avatarUrl clerkUserId")
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(100)
    .lean();

  const byUserId = new Map<string, (typeof guardianMatches)[number]>();
  for (const guardian of guardianMatches) {
    const userId =
      guardian.userId instanceof mongoose.Types.ObjectId
        ? String(guardian.userId)
        : String(guardian.userId._id);
    if (!byUserId.has(userId)) byUserId.set(userId, guardian);
  }

  const currentLinks = await Guardian.find({
    studentId: input.studentId,
    userId: { $in: Array.from(byUserId.keys()).map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("userId")
    .lean<Array<{ userId: mongoose.Types.ObjectId }>>();
  const linkedUserIds = new Set(currentLinks.map((link) => String(link.userId)));

  const results = [];
  for (const guardian of byUserId.values()) {
    const userId =
      guardian.userId instanceof mongoose.Types.ObjectId
        ? guardian.userId
        : guardian.userId._id;
    results.push({
      guardian: formatGuardianDto(guardian as Parameters<typeof formatGuardianDto>[0]),
      alreadyLinked: linkedUserIds.has(String(userId)),
      siblingCandidates: await getGuardianSiblingCandidates({
        schoolId: input.schoolId,
        studentId: input.studentId,
        userId,
      }),
    });
    if (results.length >= (input.limit || 8)) break;
  }

  return results;
}
