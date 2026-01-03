// src/app/api/admin/fees/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  if (!schoolId) {
    return NextResponse.json({ error: "School ID not found" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  try {
    // Get current date for calculations
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total revenue (all completed payments)
    const totalRevenueResult = await Payment.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountMinor" },
        },
      },
    ]);
    const totalRevenueMinor = totalRevenueResult[0]?.total || 0;

    // Revenue this month
    const monthlyRevenueResult = await Payment.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: "completed",
          paymentDate: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountMinor" },
        },
      },
    ]);
    const monthlyRevenueMinor = monthlyRevenueResult[0]?.total || 0;

    // Total outstanding (sum of all outstanding invoices)
    const outstandingResult = await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: { $in: ["issued", "partially_paid", "overdue"] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalOutstandingMinor" },
        },
      },
    ]);
    const totalOutstandingMinor = outstandingResult[0]?.total || 0;

    // Total billed (sum of all issued invoices)
    const totalBilledResult = await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: { $ne: "draft" },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmountMinor" },
        },
      },
    ]);
    const totalBilledMinor = totalBilledResult[0]?.total || 0;

    // Collection rate (total paid / total billed)
    const collectionRate =
      totalBilledMinor > 0 ? (totalRevenueMinor / totalBilledMinor) * 100 : 0;

    // Overdue invoices count
    const overdueCount = await Invoice.countDocuments({
      schoolId: schoolIdObj,
      status: "overdue",
    });

    const statusCountsAgg = await Invoice.aggregate([
      { $match: { schoolId: schoolIdObj } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts: Record<string, number> = {
      draft: 0,
      issued: 0,
      partially_paid: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
    };

    for (const row of statusCountsAgg) {
      statusCounts[row._id as string] = row.count;
    }

    const upcomingDue = await Invoice.find({
      schoolId: schoolIdObj,
      status: { $in: ["issued", "partially_paid"] },
      totalOutstandingMinor: { $gt: 0 },
      dueDate: { $gte: now, $lte: twoWeeksFromNow },
    })
      .sort({ dueDate: 1 })
      .limit(5)
      .populate("studentId", "firstName lastName admissionNo")
      .populate("academicPeriodId", "yearLabel term")
      .lean();

    const defaulters = await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: { $in: ["issued", "partially_paid", "overdue"] },
          totalOutstandingMinor: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$studentId",
          totalOutstandingMinor: { $sum: "$totalOutstandingMinor" },
          invoiceCount: { $sum: 1 },
          latestDueDate: { $max: "$dueDate" },
        },
      },
      { $sort: { totalOutstandingMinor: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $project: {
          studentId: "$_id",
          firstName: "$student.firstName",
          lastName: "$student.lastName",
          admissionNo: "$student.admissionNo",
          totalOutstandingMinor: 1,
          invoiceCount: 1,
          latestDueDate: 1,
        },
      },
    ]);

    // Recent payments (last 5)
    const recentPayments = await Payment.find({
      schoolId: schoolIdObj,
      status: "completed",
    })
      .sort({ paymentDate: -1 })
      .limit(5)
      .populate("studentId", "firstName lastName")
      .populate("invoiceId", "invoiceNumber")
      .lean();

    return NextResponse.json({
      summary: {
        totalRevenueMinor,
        monthlyRevenueMinor,
        totalOutstandingMinor,
        totalBilledMinor,
        collectionRate: Math.round(collectionRate * 100) / 100,
        overdueCount,
      },
      statusCounts,
      upcomingDue,
      defaulters,
      recentPayments,
    });
  } catch (error) {
    console.error("Error fetching fee summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch fee summary" },
      { status: 500 }
    );
  }
}
