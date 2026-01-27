import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { Subject } from "@/models/Subject";
import { AcademicPeriod, IAcademicPeriod } from "@/models/AcademicPeriod";
import { CommunityPoll } from "@/models/CommunityPoll";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import mongoose from "mongoose";

export async function GET() {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  // Ensure models are registered
  void CommunityPoll.modelName;
  void FundraisingCampaign.modelName;

  // Ensure schoolId is properly converted to ObjectId
  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const [
    studentsTotal,
    teachersTotal,
    subjectsTotal,
    // Community Hub counts
    pollsLive,
    pollsPending,
    pollsTotal,
    campaignsLive,
    campaignsPending,
    campaignsTotal,
    campaignsRaisedAgg,
  ] = await Promise.all([
    Student.countDocuments({ schoolId: schoolIdObj }),
    Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
    Subject.countDocuments({ schoolId: schoolIdObj }),
    // Polls
    CommunityPoll.countDocuments({ schoolId: schoolIdObj, status: "live" }),
    CommunityPoll.countDocuments({ schoolId: schoolIdObj, approvalStatus: "pending" }),
    CommunityPoll.countDocuments({ schoolId: schoolIdObj }),
    // Campaigns
    FundraisingCampaign.countDocuments({ schoolId: schoolIdObj, status: "live" }),
    FundraisingCampaign.countDocuments({ schoolId: schoolIdObj, approvalStatus: "pending" }),
    FundraisingCampaign.countDocuments({ schoolId: schoolIdObj }),
    // Total raised across all campaigns
    FundraisingCampaign.aggregate([
      { $match: { schoolId: schoolIdObj } },
      { $group: { _id: null, total: { $sum: "$raisedAmountMinor" } } },
    ]),
  ]);

  const periodRaw = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("yearLabel term startDate endDate isCurrent")
    .lean();
  const periodNormalized = Array.isArray(periodRaw) ? periodRaw[0] : periodRaw;
  const period = periodNormalized as Pick<
    IAcademicPeriod,
    "yearLabel" | "term" | "startDate" | "endDate"
  > | null;

  // TODO => when Payment/Invoice models arrive
  const revenueCurrent = 0;
  const revenueTrend = { deltaPct: 0, direction: "flat" as const };

  const studentsTrend = { deltaPct: 0, direction: "flat" as const };
  const teachersTrend = { deltaPct: 0, direction: "flat" as const };
  const subjectsTrend = { deltaPct: 0, direction: "flat" as const };

  const totalRaisedMinor = campaignsRaisedAgg[0]?.total ?? 0;

  return NextResponse.json({
    students: { total: studentsTotal, trend: studentsTrend },
    teachers: { total: teachersTotal, trend: teachersTrend },
    subjects: { total: subjectsTotal, trend: subjectsTrend },
    revenue: { current: revenueCurrent, trend: revenueTrend },
    period: period
      ? {
          yearLabel: period.yearLabel,
          term: period.term,
          startDate: period.startDate,
          endDate: period.endDate,
        }
      : null,
    collections: { collected: 0, outstanding: 0, rate: 0 },
    // Community Hub metrics
    community: {
      polls: {
        live: pollsLive,
        pending: pollsPending,
        total: pollsTotal,
      },
      campaigns: {
        live: campaignsLive,
        pending: campaignsPending,
        total: campaignsTotal,
        totalRaisedMinor,
      },
    },
  });
}
