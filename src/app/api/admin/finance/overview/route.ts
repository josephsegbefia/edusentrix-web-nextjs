// src/app/api/admin/finance/overview/route.ts
// Financial Center Overview API - KPIs and breakdowns

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FinancialTransaction } from "@/models/FinancialTransaction";
import { startOfDay } from "date-fns/startOfDay";
import { endOfDay } from "date-fns/endOfDay";
import { startOfWeek } from "date-fns/startOfWeek";
import { endOfWeek } from "date-fns/endOfWeek";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { subDays } from "date-fns/subDays";
import { subMonths } from "date-fns/subMonths";
import mongoose from "mongoose";

type RangeType = "today" | "this_week" | "this_month" | "last_30_days" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

function getDateRange(range: RangeType, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();
  
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_30_days":
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case "custom":
      if (customFrom && customTo) {
        return {
          start: startOfDay(new Date(customFrom)),
          end: endOfDay(new Date(customTo)),
        };
      }
      // Default to last 30 days if custom dates not provided
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPreviousRange(range: DateRange): DateRange {
  const duration = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - duration),
    end: new Date(range.end.getTime() - duration),
  };
}

// GET /api/admin/finance/overview
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const rangeType = (searchParams.get("range") || "this_month") as RangeType;
    const customFrom = searchParams.get("dateFrom") || undefined;
    const customTo = searchParams.get("dateTo") || undefined;
    const compareWithPrevious = searchParams.get("compare") === "true";

    const currentRange = getDateRange(rangeType, customFrom, customTo);
    const previousRange = compareWithPrevious ? getPreviousRange(currentRange) : null;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Build match stage for current period
    const currentMatch = {
      schoolId: schoolIdObj,
      status: "success",
      occurredAt: { $gte: currentRange.start, $lte: currentRange.end },
    };

    // Aggregate for current period
    const currentAggregation = await FinancialTransaction.aggregate([
      { $match: currentMatch },
      {
        $group: {
          _id: null,
          totalInflow: {
            $sum: {
              $cond: [{ $eq: ["$direction", "inflow"] }, "$netAmountMinor", 0],
            },
          },
          totalOutflow: {
            $sum: {
              $cond: [{ $eq: ["$direction", "outflow"] }, "$netAmountMinor", 0],
            },
          },
          inflowCount: {
            $sum: { $cond: [{ $eq: ["$direction", "inflow"] }, 1, 0] },
          },
          outflowCount: {
            $sum: { $cond: [{ $eq: ["$direction", "outflow"] }, 1, 0] },
          },
        },
      },
    ]);

    // Aggregate for previous period (if comparison enabled)
    let previousAggregation = null;
    if (previousRange) {
      const previousMatch = {
        schoolId: schoolIdObj,
        status: "success",
        occurredAt: { $gte: previousRange.start, $lte: previousRange.end },
      };
      
      previousAggregation = await FinancialTransaction.aggregate([
        { $match: previousMatch },
        {
          $group: {
            _id: null,
            totalInflow: {
              $sum: {
                $cond: [{ $eq: ["$direction", "inflow"] }, "$netAmountMinor", 0],
              },
            },
            totalOutflow: {
              $sum: {
                $cond: [{ $eq: ["$direction", "outflow"] }, "$netAmountMinor", 0],
              },
            },
          },
        },
      ]);
    }

    // Pending transactions count
    const pendingStats = await FinancialTransaction.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: { $in: ["pending", "processing"] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$grossAmountMinor" },
        },
      },
    ]);

    // Failed transactions count
    const failedStats = await FinancialTransaction.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          status: "failed",
          occurredAt: { $gte: currentRange.start, $lte: currentRange.end },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$grossAmountMinor" },
        },
      },
    ]);

    // Category breakdown
    const categoryBreakdown = await FinancialTransaction.aggregate([
      { $match: currentMatch },
      {
        $group: {
          _id: { category: "$category", direction: "$direction" },
          total: { $sum: "$netAmountMinor" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Daily trend for the period (last 14 days max for chart)
    const trendStartDate = currentRange.start;
    const dailyTrend = await FinancialTransaction.aggregate([
      { $match: currentMatch },
      {
        $group: {
          _id: "$dayKey",
          inflow: {
            $sum: {
              $cond: [{ $eq: ["$direction", "inflow"] }, "$netAmountMinor", 0],
            },
          },
          outflow: {
            $sum: {
              $cond: [{ $eq: ["$direction", "outflow"] }, "$netAmountMinor", 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 31 },
    ]);

    // Recent transactions (last 10)
    const recentTransactions = await FinancialTransaction.find({
      schoolId: schoolIdObj,
    })
      .sort({ occurredAt: -1 })
      .limit(10)
      .lean();

    // Calculate KPIs
    const current = currentAggregation[0] || {
      totalInflow: 0,
      totalOutflow: 0,
      inflowCount: 0,
      outflowCount: 0,
    };
    const previous = previousAggregation?.[0] || { totalInflow: 0, totalOutflow: 0 };
    const pending = pendingStats[0] || { count: 0, totalAmount: 0 };
    const failed = failedStats[0] || { count: 0, totalAmount: 0 };

    // Calculate percentage changes
    const calculateChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const kpis = {
      totalInflow: current.totalInflow,
      totalOutflow: current.totalOutflow,
      netPosition: current.totalInflow - current.totalOutflow,
      inflowCount: current.inflowCount,
      outflowCount: current.outflowCount,
      pendingCount: pending.count,
      pendingAmount: pending.totalAmount,
      failedCount: failed.count,
      failedAmount: failed.totalAmount,
      inflowChange: compareWithPrevious
        ? calculateChange(current.totalInflow, previous.totalInflow)
        : null,
      outflowChange: compareWithPrevious
        ? calculateChange(current.totalOutflow, previous.totalOutflow)
        : null,
    };

    // Format category breakdown into inflow/outflow groups
    const inflowByCategory: Record<string, { total: number; count: number }> = {};
    const outflowByCategory: Record<string, { total: number; count: number }> = {};

    categoryBreakdown.forEach((item) => {
      const key = item._id.category;
      const data = { total: item.total, count: item.count };
      if (item._id.direction === "inflow") {
        inflowByCategory[key] = data;
      } else {
        outflowByCategory[key] = data;
      }
    });

    return NextResponse.json({
      data: {
        kpis,
        breakdowns: {
          inflowByCategory,
          outflowByCategory,
        },
        dailyTrend,
        recentTransactions,
        range: {
          type: rangeType,
          start: currentRange.start.toISOString(),
          end: currentRange.end.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching financial overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial overview" },
      { status: 500 }
    );
  }
}
