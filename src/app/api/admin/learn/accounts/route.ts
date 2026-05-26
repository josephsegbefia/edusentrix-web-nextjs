import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { createLearnAccountForStudent } from "@/lib/learn/admin-account-service";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";

const CreateLearnAccountSchema = z.object({
  studentId: z.string().trim().min(1),
});

type AccountRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  username: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  credentialsDeliveredAt?: Date | null;
  createdAt: Date;
};

type StudentRow = {
  _id: Types.ObjectId;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  admissionNo?: string | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
};

type NamedRow = {
  _id: Types.ObjectId;
  name: string;
};

type AccessRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  source: string;
  status: string;
  expiresAt: Date;
};

function fullName(student?: StudentRow | null) {
  if (!student) return "Student";
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const accounts = await LearnStudentAccount.find({ schoolId: ctx.schoolId })
      .sort({ createdAt: -1 })
      .select("_id studentId username status mustChangePassword lastLoginAt credentialsDeliveredAt createdAt")
      .lean<AccountRow[]>();
    const studentIds = accounts.map((account) => account.studentId);
    const students = await Student.find({ _id: { $in: studentIds }, schoolId: ctx.schoolId })
      .select("_id firstName middleName lastName admissionNo gradeId classGroupId")
      .lean<StudentRow[]>();
    const gradeIds = Array.from(new Set(students.map((student) => String(student.gradeId || "")).filter(Boolean)));
    const classGroupIds = Array.from(new Set(students.map((student) => String(student.classGroupId || "")).filter(Boolean)));
    const now = new Date();
    const [grades, classGroups, accesses] = await Promise.all([
      Grade.find({ _id: { $in: gradeIds }, schoolId: ctx.schoolId }).select("_id name").lean<NamedRow[]>(),
      ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: ctx.schoolId }).select("_id name").lean<NamedRow[]>(),
      LearnAccess.find({
        schoolId: ctx.schoolId,
        studentId: { $in: studentIds },
        status: "active",
        expiresAt: { $gt: now },
      })
        .sort({ expiresAt: -1 })
        .select("_id studentId source status expiresAt")
        .lean<AccessRow[]>(),
    ]);

    const studentMap = new Map(students.map((student) => [String(student._id), student]));
    const gradeMap = new Map(grades.map((grade) => [String(grade._id), grade.name]));
    const classGroupMap = new Map(classGroups.map((classGroup) => [String(classGroup._id), classGroup.name]));
    const accessMap = new Map<string, AccessRow>();
    for (const access of accesses) {
      const key = String(access.studentId);
      if (!accessMap.has(key)) accessMap.set(key, access);
    }

    return NextResponse.json({
      success: true,
      data: {
        accounts: accounts.map((account) => {
          const student = studentMap.get(String(account.studentId));
          const access = accessMap.get(String(account.studentId));
          return {
            id: String(account._id),
            studentId: String(account.studentId),
            studentName: fullName(student),
            admissionNo: student?.admissionNo || null,
            gradeName: student?.gradeId ? gradeMap.get(String(student.gradeId)) || null : null,
            classGroupName: student?.classGroupId ? classGroupMap.get(String(student.classGroupId)) || null : null,
            username: account.username,
            status: account.status,
            mustChangePassword: account.mustChangePassword,
            lastLoginAt: account.lastLoginAt?.toISOString?.() || null,
            credentialsDeliveredAt: account.credentialsDeliveredAt?.toISOString?.() || null,
            createdAt: account.createdAt?.toISOString?.() || null,
            access: access
              ? {
                  id: String(access._id),
                  source: access.source,
                  status: access.status,
                  expiresAt: access.expiresAt.toISOString(),
                }
              : null,
          };
        }),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/accounts:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn accounts." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    const parsed = CreateLearnAccountSchema.safeParse(await req.json());
    if (!parsed.success || !Types.ObjectId.isValid(parsed.data.studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id." },
        { status: 400 }
      );
    }

    const result = await createLearnAccountForStudent({
      schoolId: ctx.schoolId,
      studentId: new Types.ObjectId(parsed.data.studentId),
      actorUserId: ctx.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/accounts:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Learn account." },
      { status: 500 }
    );
  }
}
