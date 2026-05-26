import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { School } from "@/models/School";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.learn.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const accounts = await LearnStudentAccount.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id schoolId studentId username status mustChangePassword lastLoginAt")
      .lean();
    const schoolIds = Array.from(new Set(accounts.map((account) => String(account.schoolId))));
    const studentIds = Array.from(new Set(accounts.map((account) => String(account.studentId))));
    const now = new Date();
    const [schools, students, accesses] = await Promise.all([
      School.find({ _id: { $in: schoolIds } }).select("_id name").lean(),
      Student.find({ _id: { $in: studentIds } }).select("_id firstName middleName lastName").lean(),
      LearnAccess.find({
        studentId: { $in: studentIds },
        status: "active",
        expiresAt: { $gt: now },
      })
        .select("_id studentId source expiresAt")
        .lean(),
    ]);
    const schoolMap = new Map(schools.map((school) => [String(school._id), school.name]));
    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      ])
    );
    const accessMap = new Map(accesses.map((access) => [String(access.studentId), access]));

    return NextResponse.json({
      success: true,
      data: {
        students: accounts.map((account) => {
          const access = accessMap.get(String(account.studentId));
          return {
            accountId: String(account._id),
            schoolId: String(account.schoolId),
            schoolName: schoolMap.get(String(account.schoolId)) || "School",
            studentId: String(account.studentId),
            studentName: studentMap.get(String(account.studentId)) || "Student",
            username: account.username,
            status: account.status,
            mustChangePassword: account.mustChangePassword,
            lastLoginAt: account.lastLoginAt?.toISOString?.() || null,
            activeAccess: access
              ? {
                  id: String(access._id),
                  source: access.source,
                  expiresAt: access.expiresAt.toISOString(),
                }
              : null,
          };
        }),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/students:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn students." },
      { status: 500 }
    );
  }
}
