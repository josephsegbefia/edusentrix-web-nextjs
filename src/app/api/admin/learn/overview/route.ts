import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { getLearnEligibleStudentsSummary } from "@/lib/learn/grade-eligibility";
import { ClassGroup } from "@/models/ClassGroup";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";

type ClassActivityRow = {
  _id: Types.ObjectId;
  count: number;
};

type ClassRow = {
  _id: Types.ObjectId;
  name: string;
};

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const eligibility = await getSchoolLearnEligibility(ctx.schoolId);
    const eligibleSummary = await getLearnEligibleStudentsSummary(ctx.schoolId);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      activeAccounts,
      pendingFirstLogin,
      activeAccess,
      pendingPayments,
      activityThisWeek,
      classActivityRows,
    ] = await Promise.all([
      LearnStudentAccount.countDocuments({
        schoolId: ctx.schoolId,
        status: { $in: ["pending_first_login", "active", "locked"] },
      }),
      LearnStudentAccount.countDocuments({
        schoolId: ctx.schoolId,
        status: "pending_first_login",
      }),
      LearnAccess.countDocuments({
        schoolId: ctx.schoolId,
        status: "active",
        expiresAt: { $gt: new Date() },
      }),
      LearnPaymentIntent.countDocuments({
        schoolId: ctx.schoolId,
        status: { $in: ["initiated", "awaiting_webhook"] },
      }),
      LearnActivityEvent.countDocuments({
        schoolId: ctx.schoolId,
        occurredAt: { $gte: weekStart },
      }),
      LearnActivityEvent.aggregate<ClassActivityRow>([
        {
          $match: {
            schoolId: ctx.schoolId,
            occurredAt: { $gte: weekStart },
            classGroupId: { $ne: null },
          },
        },
        { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const classIds = classActivityRows.map((row) => row._id);
    const classes = await ClassGroup.find({
      _id: { $in: classIds },
      schoolId: ctx.schoolId,
    })
      .select("_id name")
      .lean<ClassRow[]>();
    const classMap = new Map(classes.map((row) => [String(row._id), row.name]));

    return NextResponse.json({
      success: true,
      data: {
        eligibility,
        metrics: {
          eligibleStudents: eligibleSummary.eligibleStudents,
          studentsWithoutAccounts: eligibleSummary.withoutAccounts,
          gradeRange: eligibleSummary.gradeRange,
          activeAccounts,
          pendingFirstLogin,
          activeAccess,
          pendingPayments,
          activityThisWeek,
        },
        topClasses: classActivityRows.map((row) => ({
          classGroupId: String(row._id),
          classGroupName: classMap.get(String(row._id)) || "Class group",
          activityCount: row.count,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/overview:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn overview." },
      { status: 500 }
    );
  }
}
