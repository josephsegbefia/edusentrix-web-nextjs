import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { SubjectOffering } from "@/models/SubjectOffering";
import { AcademicPeriod, IAcademicPeriod } from "@/models/AcademicPeriod";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Invoice";
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
    SubjectOffering.countDocuments({ schoolId: schoolIdObj, isActive: true }),
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

  // Revenue: sum of completed payments scoped to the current academic period (or all-time if no period)
  const paymentMatch: Record<string, unknown> = {
    schoolId: schoolIdObj,
    status: "completed",
  };
  if (period) {
    paymentMatch.paymentDate = {
      $gte: new Date(period.startDate),
      $lte: new Date(period.endDate),
    };
  }

  const [revenueAgg, outstandingAgg, totalBilledAgg] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: { $in: ["issued", "partially_paid", "overdue"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalOutstandingMinor" } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: { $ne: "draft" },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmountMinor" } } },
    ]),
  ]);

  const [
    unreconciledCount,
    reversedCount,
    completedOrReversedCount,
    approvalLagAgg,
  ] = await Promise.all([
    Payment.countDocuments({
      schoolId: schoolIdObj,
      status: "completed",
      reconciliationStatus: { $ne: "fully_reconciled" },
    }),
    Payment.countDocuments({ schoolId: schoolIdObj, status: "reversed" }),
    Payment.countDocuments({
      schoolId: schoolIdObj,
      status: { $in: ["completed", "reversed"] },
    }),
    Payment.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          approvalStatus: { $in: ["approved", "rejected"] },
          reviewedAt: { $ne: null },
        },
      },
      {
        $project: {
          lagHours: {
            $divide: [{ $subtract: ["$reviewedAt", "$createdAt"] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avgLagHours: { $avg: "$lagHours" } } },
    ]),
  ]);

  const totalRevenueMinor = revenueAgg[0]?.total ?? 0;
  const totalOutstandingMinor = outstandingAgg[0]?.total ?? 0;
  const totalBilledMinor = totalBilledAgg[0]?.total ?? 0;
  const collectionRate =
    totalBilledMinor > 0
      ? Math.round(((totalRevenueMinor / totalBilledMinor) * 100) * 100) / 100
      : 0;

  // Convert minor (pesewas) to major (cedis) for the revenue display
  const revenueCurrent = Math.round(totalRevenueMinor / 100);
  const revenueTrend = { deltaPct: 0, direction: "flat" as const };

  const studentsTrend = { deltaPct: 0, direction: "flat" as const };
  const teachersTrend = { deltaPct: 0, direction: "flat" as const };
  const subjectsTrend = { deltaPct: 0, direction: "flat" as const };

  const totalRaisedMinor = campaignsRaisedAgg[0]?.total ?? 0;
  const reversalRatePct =
    completedOrReversedCount > 0
      ? Math.round((reversedCount / completedOrReversedCount) * 1000) / 10
      : 0;
  const averageApprovalLagHours =
    Math.round(Number(approvalLagAgg[0]?.avgLagHours || 0) * 10) / 10;

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
    collections: {
      collected: Math.round(totalRevenueMinor / 100),
      outstanding: Math.round(totalOutstandingMinor / 100),
      rate: collectionRate,
    },
    ledgerHealth: {
      unreconciledCount,
      averageApprovalLagHours,
      reversalRatePct,
    },
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
