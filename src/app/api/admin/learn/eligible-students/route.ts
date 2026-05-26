import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";

type StudentRow = {
  _id: Types.ObjectId;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  admissionNo?: string | null;
  status: "active" | "inactive" | "withdrawn" | "graduated";
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  photoUrl?: string | null;
};

type NamedRow = {
  _id: Types.ObjectId;
  name: string;
};

type AccountRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  username: string;
  status: string;
  mustChangePassword: boolean;
  credentialsDeliveredAt?: Date | null;
};

type GuardianCountRow = {
  _id: Types.ObjectId;
  count: number;
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fullName(student: StudentRow) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const eligibility = await getSchoolLearnEligibility(ctx.schoolId);
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 25), 100);
    const search = searchParams.get("search")?.trim() || "";
    const includeExisting = searchParams.get("includeExisting") === "true";

    if (!eligibility.eligible) {
      return NextResponse.json({
        success: true,
        data: {
          eligibility,
          students: [],
          summary: {
            eligibleStudents: 0,
            withAccounts: 0,
            withoutAccounts: 0,
            withGuardians: 0,
          },
          pagination: { page, limit, total: 0, totalPages: 0 },
        },
      });
    }

    const query: Record<string, unknown> = {
      schoolId: ctx.schoolId,
      status: "active",
      gradeId: { $exists: true, $ne: null },
      classGroupId: { $exists: true, $ne: null },
    };

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { firstName: regex },
        { middleName: regex },
        { lastName: regex },
        { admissionNo: regex },
      ];
    }

    const [allActiveStudents, accounts] = await Promise.all([
      Student.find({
        schoolId: ctx.schoolId,
        status: "active",
        gradeId: { $exists: true, $ne: null },
        classGroupId: { $exists: true, $ne: null },
      })
        .select("_id")
        .lean<Array<{ _id: Types.ObjectId }>>(),
      LearnStudentAccount.find({ schoolId: ctx.schoolId })
        .select("_id studentId username status mustChangePassword credentialsDeliveredAt")
        .lean<AccountRow[]>(),
    ]);

    if (!includeExisting) {
      query._id = { $nin: accounts.map((account) => account.studentId) };
    }

    const skip = (page - 1) * limit;
    const [students, total] = await Promise.all([
      Student.find(query)
        .select(
          "_id firstName middleName lastName admissionNo status gradeId classGroupId photoUrl"
        )
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean<StudentRow[]>(),
      Student.countDocuments(query),
    ]);

    const allActiveStudentIds = allActiveStudents.map((student) => student._id);
    const guardianCounts = await Guardian.aggregate<GuardianCountRow>([
      { $match: { studentId: { $in: allActiveStudentIds } } },
      {
        $group: {
          _id: "$studentId",
          count: { $sum: 1 },
        },
      },
    ]);

    const gradeIds = Array.from(
      new Set(students.map((student) => String(student.gradeId)).filter(Boolean))
    );
    const classGroupIds = Array.from(
      new Set(students.map((student) => String(student.classGroupId)).filter(Boolean))
    );

    const [grades, classGroups] = await Promise.all([
      Grade.find({ _id: { $in: gradeIds }, schoolId: ctx.schoolId })
        .select("_id name")
        .lean<NamedRow[]>(),
      ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: ctx.schoolId })
        .select("_id name")
        .lean<NamedRow[]>(),
    ]);

    const gradeMap = new Map(grades.map((grade) => [String(grade._id), grade.name]));
    const classGroupMap = new Map(
      classGroups.map((classGroup) => [String(classGroup._id), classGroup.name])
    );
    const accountMap = new Map(accounts.map((account) => [String(account.studentId), account]));
    const guardianCountMap = new Map(
      guardianCounts.map((row) => [String(row._id), row.count])
    );
    const activeStudentIds = new Set(allActiveStudents.map((student) => String(student._id)));
    const activeAccountCount = accounts.filter((account) =>
      activeStudentIds.has(String(account.studentId))
    ).length;
    const withGuardians = allActiveStudents.filter(
      (student) => (guardianCountMap.get(String(student._id)) || 0) > 0
    ).length;

    const rows = students
      .map((student) => {
        const account = accountMap.get(String(student._id));
        return {
          id: String(student._id),
          fullName: fullName(student),
          admissionNo: student.admissionNo || null,
          photoUrl: student.photoUrl || null,
          gradeId: student.gradeId ? String(student.gradeId) : null,
          gradeName: student.gradeId
            ? gradeMap.get(String(student.gradeId)) || null
            : null,
          classGroupId: student.classGroupId ? String(student.classGroupId) : null,
          classGroupName: student.classGroupId
            ? classGroupMap.get(String(student.classGroupId)) || null
            : null,
          guardianCount: guardianCountMap.get(String(student._id)) || 0,
          account: account
            ? {
                id: String(account._id),
                username: account.username,
                status: account.status,
                mustChangePassword: account.mustChangePassword,
                credentialsDeliveredAt:
                  account.credentialsDeliveredAt?.toISOString?.() || null,
              }
            : null,
        };
      })
      .filter((row) => includeExisting || !row.account);

    return NextResponse.json({
      success: true,
      data: {
        eligibility,
        students: rows,
        summary: {
          eligibleStudents: allActiveStudents.length,
          withAccounts: activeAccountCount,
          withoutAccounts: Math.max(0, allActiveStudents.length - activeAccountCount),
          withGuardians,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/eligible-students:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load eligible Learn students." },
      { status: 500 }
    );
  }
}
