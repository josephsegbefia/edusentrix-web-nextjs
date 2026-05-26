import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";

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
 * Minimal mobile auth context for background Explore workers (delivery complete, etc.).
 * Uses the first active student in the class with a Learn account.
 */
export async function buildExploreWorkerContextForClass(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}): Promise<LearnMobileStudentContext | null> {
  await connectToDatabase();

  const student = await Student.findOne({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: "active",
  })
    .select("_id schoolId gradeId classGroupId userId")
    .sort({ updatedAt: -1 })
    .lean<{
      _id: Types.ObjectId;
      schoolId: Types.ObjectId;
      gradeId?: Types.ObjectId | null;
      classGroupId?: Types.ObjectId | null;
    } | null>();

  if (!student) return null;

  const account = await LearnStudentAccount.findOne({
    schoolId: input.schoolId,
    studentId: student._id,
    status: "active",
  })
    .select("_id mustChangePassword")
    .lean<{ _id: Types.ObjectId; mustChangePassword?: boolean } | null>();

  if (!account) return null;

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
