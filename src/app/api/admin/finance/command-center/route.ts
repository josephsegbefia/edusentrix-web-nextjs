import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { endOfDay } from "date-fns/endOfDay";
import { endOfMonth } from "date-fns/endOfMonth";
import { endOfWeek } from "date-fns/endOfWeek";
import { startOfDay } from "date-fns/startOfDay";
import { startOfMonth } from "date-fns/startOfMonth";
import { startOfWeek } from "date-fns/startOfWeek";
import { subDays } from "date-fns/subDays";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { FinancialTransaction } from "@/models/FinancialTransaction";
import { Invoice } from "@/models/Invoice";
import { ReconciliationAlert } from "@/models/ReconciliationAlert";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { ReconciliationRun } from "@/models/ReconciliationRun";
import { SchoolExpense } from "@/models/SchoolExpense";

type RangeType = "today" | "this_week" | "this_month" | "last_30_days" | "custom";

type DateRange = {
  start: Date;
  end: Date;
  label: string;
};

function getDateRange(range: RangeType, customFrom?: string | null, customTo?: string | null): DateRange {
  const now = new Date();
  if (range === "today") return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
  if (range === "this_week") {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
      label: "This week",
    };
  }
  if (range === "last_30_days") {
    return { start: startOfDay(subDays(now, 30)), end: endOfDay(now), label: "Last 30 days" };
  }
  if (range === "custom" && customFrom && customTo) {
    return {
      start: startOfDay(new Date(customFrom)),
      end: endOfDay(new Date(customTo)),
      label: "Custom range",
    };
  }
  return { start: startOfMonth(now), end: endOfMonth(now), label: "This month" };
}

function toObjectId(value: unknown) {
  return new mongoose.Types.ObjectId(String(value));
}

function makeQueueItem(input: {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  href: string;
  count?: number;
  amountMinor?: number;
  evidence?: Array<{ label: string; value: string }>;
}) {
  return {
    ...input,
    leoEnabled: true,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const rangeType = (sp.get("range") || "this_month") as RangeType;
    const currentRange = getDateRange(rangeType, sp.get("dateFrom"), sp.get("dateTo"));
    const schoolIdObj = toObjectId(schoolId);

    const successMatch = {
      schoolId: schoolIdObj,
      status: "success",
      occurredAt: { $gte: currentRange.start, $lte: currentRange.end },
    };

    const [
      transactionAgg,
      pendingTransactionAgg,
      failedTransactionAgg,
      receivablesAgg,
      overdueStudentAgg,
      topOverdue,
      reconciliationAgg,
      activeAlerts,
      latestRun,
      pendingExpenseAgg,
      recentExpenses,
    ] = await Promise.all([
      FinancialTransaction.aggregate([
        { $match: successMatch },
        {
          $group: {
            _id: null,
            collectedMinor: {
              $sum: { $cond: [{ $eq: ["$direction", "inflow"] }, "$netAmountMinor", 0] },
            },
            outflowMinor: {
              $sum: { $cond: [{ $eq: ["$direction", "outflow"] }, "$netAmountMinor", 0] },
            },
            inflowCount: { $sum: { $cond: [{ $eq: ["$direction", "inflow"] }, 1, 0] } },
            outflowCount: { $sum: { $cond: [{ $eq: ["$direction", "outflow"] }, 1, 0] } },
          },
        },
      ]),
      FinancialTransaction.aggregate([
        { $match: { schoolId: schoolIdObj, status: { $in: ["pending", "processing", "held"] } } },
        { $group: { _id: null, count: { $sum: 1 }, amountMinor: { $sum: "$grossAmountMinor" } } },
      ]),
      FinancialTransaction.aggregate([
        { $match: { ...successMatch, status: "failed" } },
        { $group: { _id: null, count: { $sum: 1 }, amountMinor: { $sum: "$grossAmountMinor" } } },
      ]),
      Invoice.aggregate([
        { $match: { schoolId: schoolIdObj, status: { $ne: "draft" } } },
        {
          $group: {
            _id: null,
            billedMinor: { $sum: "$totalAmountMinor" },
            outstandingMinor: { $sum: "$totalOutstandingMinor" },
            overdueFeesMinor: {
              $sum: { $cond: [{ $eq: ["$status", "overdue"] }, "$totalOutstandingMinor", 0] },
            },
            overdueInvoiceCount: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            schoolId: schoolIdObj,
            status: "overdue",
            totalOutstandingMinor: { $gt: 0 },
          },
        },
        { $group: { _id: "$studentId" } },
        { $count: "count" },
      ]),
      Invoice.aggregate([
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
            amountMinor: { $sum: "$totalOutstandingMinor" },
            latestDueDate: { $max: "$dueDate" },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { amountMinor: -1 } },
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
            studentName: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$student.firstName", ""] },
                    " ",
                    { $ifNull: ["$student.lastName", ""] },
                  ],
                },
              },
            },
            className: null,
            guardianName: null,
            amountMinor: 1,
            latestDueDate: 1,
            invoiceCount: 1,
          },
        },
      ]),
      ReconciliationIngestion.aggregate([
        { $match: { schoolId: schoolIdObj } },
        { $group: { _id: "$status", count: { $sum: 1 }, amountMinor: { $sum: "$amountMinor" } } },
      ]),
      ReconciliationAlert.find({ schoolId: schoolIdObj, status: "active" })
        .sort({ severity: 1, lastDetectedAt: -1 })
        .limit(20)
        .lean(),
      ReconciliationRun.findOne({ schoolId: schoolIdObj }).sort({ startedAt: -1 }).lean(),
      SchoolExpense.aggregate([
        { $match: { schoolId: schoolIdObj, status: "submitted" } },
        { $group: { _id: null, count: { $sum: 1 }, amountMinor: { $sum: "$amountMinor" } } },
      ]),
      SchoolExpense.find({ schoolId: schoolIdObj })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("_id expenseNumber status title amountMinor currency expenseDate updatedAt")
        .lean(),
    ]);

    const transactions = transactionAgg[0] || {
      collectedMinor: 0,
      outflowMinor: 0,
      inflowCount: 0,
      outflowCount: 0,
    };
    const pendingTransactions = pendingTransactionAgg[0] || { count: 0, amountMinor: 0 };
    const failedTransactions = failedTransactionAgg[0] || { count: 0, amountMinor: 0 };
    const receivables = receivablesAgg[0] || {
      billedMinor: 0,
      outstandingMinor: 0,
      overdueFeesMinor: 0,
      overdueInvoiceCount: 0,
    };
    const overdueStudentCount = overdueStudentAgg[0]?.count || 0;
    const pendingExpenses = pendingExpenseAgg[0] || { count: 0, amountMinor: 0 };

    const reconciliationCounts = {
      matched: 0,
      unmatched: 0,
      ambiguous: 0,
      ignored: 0,
      amountMinor: {
        matched: 0,
        unmatched: 0,
        ambiguous: 0,
        ignored: 0,
      },
    };
    for (const row of reconciliationAgg) {
      const key = row._id as keyof Omit<typeof reconciliationCounts, "amountMinor">;
      if (key in reconciliationCounts && key !== "amountMinor") {
        reconciliationCounts[key] = row.count;
        reconciliationCounts.amountMinor[key] = row.amountMinor;
      }
    }

    const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
    const pendingApprovalCount = pendingTransactions.count + pendingExpenses.count;
    const pendingApprovalMinor = pendingTransactions.amountMinor + pendingExpenses.amountMinor;
    const unreconciledCount = reconciliationCounts.unmatched + reconciliationCounts.ambiguous;
    const unreconciledMinor =
      reconciliationCounts.amountMinor.unmatched + reconciliationCounts.amountMinor.ambiguous;

    const workQueue = [];
    if (pendingApprovalCount > 0) {
      workQueue.push(
        makeQueueItem({
          id: "pending-approvals",
          type: "payment_approval",
          severity: "warning",
          title: "Finance approvals pending",
          description: "Payments or expenses need review before finance records are reliable.",
          href: "/admin/finance/payments",
          count: pendingApprovalCount,
          amountMinor: pendingApprovalMinor,
        })
      );
    }
    if (unreconciledCount > 0) {
      workQueue.push(
        makeQueueItem({
          id: "reconciliation-review",
          type: "unmatched_reconciliation",
          severity: criticalAlerts > 0 || reconciliationCounts.unmatched > 10 ? "critical" : "warning",
          title: "Reconciliation needs review",
          description: "Bank or gateway evidence is not fully matched to recorded payments.",
          href: "/admin/finance/reconciliation/sessions",
          count: unreconciledCount,
          amountMinor: unreconciledMinor,
        })
      );
    }
    if (receivables.overdueInvoiceCount > 0) {
      workQueue.push(
        makeQueueItem({
          id: "overdue-fees",
          type: "overdue_reminder",
          severity: "warning",
          title: "Overdue fee accounts",
          description: "Follow up with families that have overdue invoices.",
          href: "/admin/fees",
          count: overdueStudentCount,
          amountMinor: receivables.overdueFeesMinor,
        })
      );
    }
    if (failedTransactions.count > 0) {
      workQueue.push(
        makeQueueItem({
          id: "failed-transactions",
          type: "failed_payment",
          severity: "critical",
          title: "Failed transactions",
          description: "Failed records need review before reports are shared.",
          href: "/admin/finance/transactions?status=failed",
          count: failedTransactions.count,
          amountMinor: failedTransactions.amountMinor,
        })
      );
    }
    if (criticalAlerts > 0) {
      workQueue.push(
        makeQueueItem({
          id: "critical-alerts",
          type: "ambiguous_reconciliation",
          severity: "critical",
          title: "Critical reconciliation alerts",
          description: "Critical alerts may affect collection reliability.",
          href: "/admin/finance/reconciliation/sessions",
          count: criticalAlerts,
        })
      );
    }

    const trustStatus =
      criticalAlerts > 0 || failedTransactions.count > 0
        ? "critical"
        : unreconciledCount > 0 || pendingApprovalCount > 0
          ? "needs_review"
          : "healthy";

    return NextResponse.json({
      success: true,
      data: {
        context: {
          schoolId: String(schoolId),
          academicPeriodId: sp.get("academicPeriodId") || null,
          academicPeriodLabel: null,
          range: {
            start: currentRange.start.toISOString(),
            end: currentRange.end.toISOString(),
            label: currentRange.label,
          },
          currency: "GHS",
          lastRefreshedAt: new Date().toISOString(),
        },
        kpis: {
          collectedMinor: transactions.collectedMinor,
          collectedCount: transactions.inflowCount,
          outstandingFeesMinor: receivables.outstandingMinor,
          overdueFeesMinor: receivables.overdueFeesMinor,
          overdueStudentCount,
          pendingApprovalCount,
          pendingApprovalMinor,
          unreconciledCount,
          unreconciledMinor,
          netCashMovementMinor: transactions.collectedMinor - transactions.outflowMinor,
          failedTransactionCount: failedTransactions.count,
          failedTransactionMinor: failedTransactions.amountMinor,
        },
        workQueue,
        trust: {
          status: trustStatus,
          lastReconciliationAt: latestRun?.startedAt?.toISOString?.() || null,
          matchedCount: reconciliationCounts.matched,
          unmatchedCount: reconciliationCounts.unmatched,
          ambiguousCount: reconciliationCounts.ambiguous,
          activeAlertCount: activeAlerts.length,
          criticalAlertCount: criticalAlerts,
          failedTransactionCount: failedTransactions.count,
          makerCheckerPendingCount: pendingApprovalCount,
          paymentSetupStatus: null,
        },
        fees: {
          totalBilledMinor: receivables.billedMinor,
          totalCollectedMinor: transactions.collectedMinor,
          totalOutstandingMinor: receivables.outstandingMinor,
          collectionRate:
            receivables.billedMinor > 0
              ? Math.round((transactions.collectedMinor / receivables.billedMinor) * 10000) / 100
              : 0,
          topOverdue: topOverdue.map((row) => ({
            studentId: String(row.studentId),
            studentName: row.studentName || "Student",
            guardianName: row.guardianName || null,
            className: row.className || null,
            amountMinor: row.amountMinor || 0,
            latestDueDate: row.latestDueDate?.toISOString?.() || null,
            invoiceCount: row.invoiceCount || 0,
          })),
        },
        reconciliation: {
          latestRunId: latestRun?._id ? String(latestRun._id) : null,
          matchedCount: reconciliationCounts.matched,
          unmatchedCount: reconciliationCounts.unmatched,
          ambiguousCount: reconciliationCounts.ambiguous,
          ignoredCount: reconciliationCounts.ignored,
          activeAlerts: activeAlerts.map((alert) => ({
            id: String(alert._id),
            title: alert.title,
            severity: alert.severity,
            count: alert.count,
            description: alert.description,
          })),
        },
        expenses: {
          pendingApprovalCount: pendingExpenses.count,
          pendingApprovalMinor: pendingExpenses.amountMinor,
          recent: recentExpenses.map((expense) => ({
            id: String(expense._id),
            title: expense.title,
            expenseNumber: expense.expenseNumber,
            status: expense.status,
            amountMinor: expense.amountMinor,
            currency: expense.currency,
            expenseDate: expense.expenseDate?.toISOString?.() || null,
          })),
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching finance command center:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch finance command center" },
      { status: 500 }
    );
  }
}
