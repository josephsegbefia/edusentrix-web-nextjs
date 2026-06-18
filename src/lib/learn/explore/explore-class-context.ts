import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";

const USABLE_LEARN_ACCOUNT_STATUSES = ["pending_first_login", "active", "locked"] as const;

/** Grade label used in class-scoped Explore generation keys. */
export async function resolveGradeLevelForClassGroup(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  await connectToDatabase();

  const classGroup = await ClassGroup.findOne({
    _id: input.classGroupId,
    schoolId: input.schoolId,
  })
    .select("gradeId")
    .lean<{ gradeId?: Types.ObjectId | null } | null>();

  if (!classGroup?.gradeId) {
    return "Your grade";
  }

  const grade = await Grade.findOne({
    _id: classGroup.gradeId,
    schoolId: input.schoolId,
  })
    .select("name")
    .lean<{ name?: string } | null>();

  return grade?.name?.trim() || "Your grade";
}

/**
 * Minimal mobile auth context for background Explore workers.
 * Prefers any student in the class with a Learn account (including pending first login).
 */
export async function buildExploreWorkerContextForClass(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}): Promise<LearnMobileStudentContext | null> {
  await connectToDatabase();

  const students = await Student.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: "active",
  })
    .select("_id schoolId gradeId classGroupId")
    .lean<
      Array<{
        _id: Types.ObjectId;
        schoolId: Types.ObjectId;
        gradeId?: Types.ObjectId | null;
        classGroupId?: Types.ObjectId | null;
      }>
    >();

  if (!students.length) return null;

  const studentMap = new Map(students.map((row) => [String(row._id), row]));
  const studentIds = students.map((row) => row._id);

  const account = await LearnStudentAccount.findOne({
    schoolId: input.schoolId,
    studentId: { $in: studentIds },
    status: { $in: USABLE_LEARN_ACCOUNT_STATUSES },
  })
    .select("_id studentId mustChangePassword")
    .sort({ updatedAt: -1 })
    .lean<{
      _id: Types.ObjectId;
      studentId: Types.ObjectId;
      mustChangePassword?: boolean;
    } | null>();

  if (!account) return null;

  const student = studentMap.get(String(account.studentId));
  if (!student) return null;

  return {
    accountId: account._id,
    sessionId: account._id,
    studentId: student._id,
    schoolId: student.schoolId,
    gradeId: student.gradeId ?? null,
    classGroupId: student.classGroupId ?? input.classGroupId,
    mustChangePassword: account.mustChangePassword ?? false,
  };
}
