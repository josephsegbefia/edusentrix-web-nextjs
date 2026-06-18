import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";

export const LEARN_GRADE_RANGE_LABEL = "Primary 4 / Grade 4 through JHS 3";

const LEARN_ELIGIBLE_GRADE_CODES = new Set([
  "P4",
  "G4",
  "P5",
  "P6",
  "JHS1",
  "JHS2",
  "JHS3",
]);

const LEARN_ELIGIBLE_GRADE_NAMES = new Set([
  "primary 4",
  "grade 4",
  "p4",
  "g4",
  "primary 5",
  "grade 5",
  "p5",
  "g5",
  "primary 6",
  "grade 6",
  "p6",
  "g6",
  "jhs 1",
  "jhs1",
  "jhs 2",
  "jhs2",
  "jhs 3",
  "jhs3",
]);

export type LearnGradeRef = {
  _id?: Types.ObjectId;
  name: string;
  code?: string | null;
};

function normalizeGradeCode(code?: string | null): string {
  return (code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeGradeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isLearnEligibleGrade(grade: LearnGradeRef): boolean {
  const code = normalizeGradeCode(grade.code);
  if (code && LEARN_ELIGIBLE_GRADE_CODES.has(code)) {
    return true;
  }

  const name = normalizeGradeName(grade.name);
  return LEARN_ELIGIBLE_GRADE_NAMES.has(name);
}

export async function getLearnEligibleGradeIdsForSchool(
  schoolId: Types.ObjectId,
): Promise<Types.ObjectId[]> {
  await connectToDatabase();

  const grades = await Grade.find({ schoolId, isActive: true })
    .select("_id name code")
    .lean<LearnGradeRef[]>();

  return grades
    .filter((grade) => isLearnEligibleGrade(grade))
    .map((grade) => grade._id!)
    .filter(Boolean);
}

export function buildLearnEligibleStudentFilter(input: {
  schoolId: Types.ObjectId;
  eligibleGradeIds: Types.ObjectId[];
}) {
  return {
    schoolId: input.schoolId,
    status: "active" as const,
    gradeId: { $in: input.eligibleGradeIds },
    classGroupId: { $exists: true, $ne: null },
  };
}

export async function countLearnEligibleActiveStudents(
  schoolId: Types.ObjectId,
): Promise<number> {
  const eligibleGradeIds = await getLearnEligibleGradeIdsForSchool(schoolId);
  if (!eligibleGradeIds.length) return 0;

  return Student.countDocuments(
    buildLearnEligibleStudentFilter({ schoolId, eligibleGradeIds }),
  );
}

export async function getLearnEligibleStudentsSummary(schoolId: Types.ObjectId) {
  await connectToDatabase();

  const eligibleGradeIds = await getLearnEligibleGradeIdsForSchool(schoolId);
  if (!eligibleGradeIds.length) {
    return {
      gradeRange: LEARN_GRADE_RANGE_LABEL,
      eligibleStudents: 0,
      withAccounts: 0,
      withoutAccounts: 0,
      eligibleGradeCount: 0,
    };
  }

  const baseFilter = buildLearnEligibleStudentFilter({ schoolId, eligibleGradeIds });

  const [eligibleStudents, accounts, eligibleStudentRows] = await Promise.all([
    Student.countDocuments(baseFilter),
    LearnStudentAccount.find({ schoolId })
      .select("studentId status")
      .lean<Array<{ studentId: Types.ObjectId; status: string }>>(),
    Student.find(baseFilter).select("_id").lean<Array<{ _id: Types.ObjectId }>>(),
  ]);

  const eligibleStudentIdSet = new Set(
    eligibleStudentRows.map((student) => String(student._id)),
  );
  const withAccounts = accounts.filter((account) =>
    eligibleStudentIdSet.has(String(account.studentId)),
  ).length;

  return {
    gradeRange: LEARN_GRADE_RANGE_LABEL,
    eligibleStudents,
    withAccounts,
    withoutAccounts: Math.max(0, eligibleStudents - withAccounts),
    eligibleGradeCount: eligibleGradeIds.length,
  };
}

export async function findLearnEligibleStudentIdsWithoutAccounts(
  schoolId: Types.ObjectId,
): Promise<Types.ObjectId[]> {
  await connectToDatabase();

  const eligibleGradeIds = await getLearnEligibleGradeIdsForSchool(schoolId);
  if (!eligibleGradeIds.length) return [];

  const [students, accounts] = await Promise.all([
    Student.find(buildLearnEligibleStudentFilter({ schoolId, eligibleGradeIds }))
      .select("_id")
      .lean<Array<{ _id: Types.ObjectId }>>(),
    LearnStudentAccount.find({ schoolId }).select("studentId").lean<Array<{ studentId: Types.ObjectId }>>(),
  ]);

  const accountStudentIds = new Set(accounts.map((account) => String(account.studentId)));

  return students
    .map((student) => student._id)
    .filter((studentId) => !accountStudentIds.has(String(studentId)));
}
