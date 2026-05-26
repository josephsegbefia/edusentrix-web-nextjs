import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getStudentLearnAccess, toMobileAccessSource } from "@/lib/learn/access";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { School } from "@/models/School";
import { Student } from "@/models/Student";

type StudentRow = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  photoUrl?: string | null;
  status: string;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
};

function displayName(student: Pick<StudentRow, "firstName" | "middleName" | "lastName">) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function studentUserId(student: StudentRow) {
  return student.userId ? String(student.userId) : String(student._id);
}

export async function loadMobileStudentBundle(input: {
  studentId: Types.ObjectId;
  schoolId: Types.ObjectId;
  accountId: Types.ObjectId;
}) {
  await connectToDatabase();

  const student = await Student.findOne({ _id: input.studentId, schoolId: input.schoolId })
    .select(
      "_id schoolId userId firstName middleName lastName photoUrl status gradeId classGroupId"
    )
    .lean<StudentRow | null>();

  if (!student) return null;

  const [school, account, grade, classGroup, currentPeriod, accessResult] = await Promise.all([
    School.findById(input.schoolId)
      .select("_id name logo")
      .lean<{ _id: Types.ObjectId; name: string; logo?: string | null } | null>(),
    LearnStudentAccount.findById(input.accountId)
      .select("_id mustChangePassword status")
      .lean<{ _id: Types.ObjectId; mustChangePassword: boolean; status: string } | null>(),
    student.gradeId
      ? Grade.findOne({ _id: student.gradeId, schoolId: input.schoolId })
          .select("name")
          .lean<{ name?: string } | null>()
      : Promise.resolve(null),
    student.classGroupId
      ? ClassGroup.findOne({ _id: student.classGroupId, schoolId: input.schoolId })
          .select("name")
          .lean<{ name?: string } | null>()
      : Promise.resolve(null),
    AcademicPeriod.findOne({ schoolId: input.schoolId, isCurrent: true })
      .select("yearLabel term")
      .lean<{ yearLabel?: string; term?: string } | null>(),
    getStudentLearnAccess({
      schoolId: input.schoolId,
      studentId: input.studentId,
      accountId: input.accountId,
    }),
  ]);

  if (!school || !account) return null;

  return {
    student,
    school,
    account,
    gradeName: grade?.name,
    classGroupName: classGroup?.name,
    academicYearName: currentPeriod?.yearLabel,
    termName: currentPeriod?.term,
    accessResult,
  };
}

export function serializeMobileStudentMe(
  bundle: NonNullable<Awaited<ReturnType<typeof loadMobileStudentBundle>>>
) {
  const { student, school, account, gradeName, classGroupName, academicYearName, termName } =
    bundle;

  return {
    studentId: String(student._id),
    schoolId: String(student.schoolId),
    firstName: student.firstName,
    lastName: student.lastName,
    displayName: displayName(student),
    photoUrl: student.photoUrl ?? null,
    schoolName: school.name,
    gradeName: gradeName || "",
    classGroupName: classGroupName || "",
    academicYearName,
    termName,
    mustChangePassword: account.mustChangePassword,
  };
}

export function serializeMobileLoginStudent(
  bundle: NonNullable<Awaited<ReturnType<typeof loadMobileStudentBundle>>>
) {
  const me = serializeMobileStudentMe(bundle);
  const { student, accessResult } = bundle;

  return {
    ...me,
    userId: studentUserId(student),
    premiumAccess: {
      hasEduSentrixLearn: accessResult.hasAccess,
      planName: accessResult.schoolEligibility.planName ?? null,
      blockedReason: accessResult.blockedReason,
    },
  };
}

export function serializeMobileEntitlement(
  bundle: NonNullable<Awaited<ReturnType<typeof loadMobileStudentBundle>>>
) {
  const { school, student, accessResult } = bundle;

  return {
    hasEduSentrixLearn: accessResult.hasAccess,
    schoolEligible: accessResult.schoolEligible,
    accessStatus: accessResult.accessStatus,
    planName: accessResult.schoolEligibility.planName ?? null,
    accessSource: toMobileAccessSource(accessResult.access?.source),
    expiresAt: accessResult.access?.expiresAt
      ? accessResult.access.expiresAt.toISOString()
      : null,
    blockedReason: accessResult.blockedReason,
    schoolId: String(student.schoolId),
    schoolName: school.name,
  };
}
