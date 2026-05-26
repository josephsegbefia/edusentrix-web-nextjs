import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { School } from "@/models/School";

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.learn.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const [schools, accounts, parentPaid, gifted, expired, revenue, activity] =
      await Promise.all([
        School.countDocuments({ status: "active" }),
        LearnStudentAccount.countDocuments({
          status: { $in: ["pending_first_login", "active", "locked"] },
        }),
        LearnAccess.countDocuments({
          source: "parent_paid",
          status: "active",
          expiresAt: { $gt: now },
        }),
        LearnAccess.countDocuments({
          source: "platform_gift",
          status: "active",
          expiresAt: { $gt: now },
        }),
        LearnAccess.countDocuments({ expiresAt: { $lte: now } }),
        LearnPaymentIntent.aggregate<{ _id: null; total: number }>([
          { $match: { status: "succeeded" } },
          { $group: { _id: null, total: { $sum: "$amountMinor" } } },
        ]),
        LearnActivityEvent.countDocuments({ occurredAt: { $gte: weekStart } }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        schools,
        accounts,
        parentPaid,
        gifted,
        expired,
        revenueMinor: revenue[0]?.total || 0,
        activityThisWeek: activity,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/overview:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load platform Learn overview." },
      { status: 500 }
    );
  }
}
