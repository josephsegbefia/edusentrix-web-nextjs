import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { School } from "@/models/School";

type SchoolRow = {
  _id: Types.ObjectId;
  name: string;
  status: string;
};

type CountRow = {
  _id: Types.ObjectId;
  count: number;
};

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.learn.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const schools = await School.find({})
      .sort({ name: 1 })
      .limit(250)
      .select("_id name status")
      .lean<SchoolRow[]>();
    const schoolIds = schools.map((school) => school._id);
    const now = new Date();
    const [accounts, activeAccesses] = await Promise.all([
      LearnStudentAccount.aggregate<CountRow>([
        { $match: { schoolId: { $in: schoolIds } } },
        { $group: { _id: "$schoolId", count: { $sum: 1 } } },
      ]),
      LearnAccess.aggregate<CountRow>([
        {
          $match: {
            schoolId: { $in: schoolIds },
            status: "active",
            expiresAt: { $gt: now },
          },
        },
        { $group: { _id: "$schoolId", count: { $sum: 1 } } },
      ]),
    ]);
    const accountMap = new Map(accounts.map((row) => [String(row._id), row.count]));
    const accessMap = new Map(activeAccesses.map((row) => [String(row._id), row.count]));

    const rows = await Promise.all(
      schools.map(async (school) => {
        const eligibility = await getSchoolLearnEligibility(school._id);
        return {
          schoolId: String(school._id),
          schoolName: school.name,
          status: school.status,
          eligibility,
          accounts: accountMap.get(String(school._id)) || 0,
          activeAccess: accessMap.get(String(school._id)) || 0,
        };
      })
    );

    return NextResponse.json({ success: true, data: { schools: rows } });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/schools:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn schools." },
      { status: 500 }
    );
  }
}
