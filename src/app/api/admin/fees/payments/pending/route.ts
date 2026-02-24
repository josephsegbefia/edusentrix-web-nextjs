/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Invoice";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";

type QueueKey =
  | "pending_approval"
  | "unmatched"
  | "needs_reconciliation"
  | "reversal_blocked";

const QUEUE_CONFIG: Record<
  QueueKey,
  { label: string; description: string; slaHours: number }
> = {
  pending_approval: {
    label: "Pending Approval",
    description: "Proof payments awaiting bursar/admin review.",
    slaHours: 24,
  },
  unmatched: {
    label: "Unmatched",
    description:
      "Completed payments not linked to any settlement evidence yet.",
    slaHours: 24,
  },
  needs_reconciliation: {
    label: "Needs Reconciliation",
    description:
      "Partially reconciled payments that still need gateway/bank/manual completion.",
    slaHours: 48,
  },
  reversal_blocked: {
    label: "Reversal Blocked",
    description:
      "Payments that generated credit and cannot be reversed until credit usage is resolved.",
    slaHours: 0,
  },
};

function parseObjectId(
  value: string | null,
  name: string
): mongoose.Types.ObjectId | null {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function hoursSince(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function queueFilter(queue: QueueKey, blockedIds: mongoose.Types.ObjectId[]) {
  if (queue === "pending_approval") {
    return { status: "pending", approvalStatus: "pending" };
  }
  if (queue === "unmatched") {
    return { status: "completed", reconciliationStatus: "unmatched" };
  }
  if (queue === "needs_reconciliation") {
    return {
      status: "completed",
      reconciliationStatus: { $in: ["needs_review", "gateway_verified", "bank_matched"] },
    };
  }
  return {
    status: "completed",
    _id: blockedIds.length ? { $in: blockedIds } : { $in: [] },
  };
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { searchParams } = new URL(req.url);
    const queue = (searchParams.get("queue") ||
      "pending_approval") as QueueKey;
    if (!Object.keys(QUEUE_CONFIG).includes(queue)) {
      return NextResponse.json({ error: "Invalid queue" }, { status: 400 });
    }

    const studentId = parseObjectId(searchParams.get("studentId"), "student ID");
    const invoiceId = parseObjectId(searchParams.get("invoiceId"), "invoice ID");
    const academicPeriodId = parseObjectId(
      searchParams.get("academicPeriodId"),
      "academic period ID"
    );
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
      50
    );

    const baseQuery: any = { schoolId };
    if (studentId) baseQuery.studentId = studentId;

    // Build invoice scope for optional period/invoice filter.
    const invoiceScopeQuery: any = { schoolId };
    let hasInvoiceScope = false;
    if (invoiceId) {
      invoiceScopeQuery._id = invoiceId;
      hasInvoiceScope = true;
    }
    if (academicPeriodId) {
      invoiceScopeQuery.academicPeriodId = academicPeriodId;
      hasInvoiceScope = true;
    }
    if (studentId) {
      invoiceScopeQuery.studentId = studentId;
      hasInvoiceScope = true;
    }

    if (hasInvoiceScope) {
      const scopedInvoices = await Invoice.find(invoiceScopeQuery)
        .select("_id")
        .lean();
      const scopedInvoiceIds = scopedInvoices.map((invoice: any) => invoice._id);
      baseQuery.invoiceId = { $in: scopedInvoiceIds };
    }

    const creditPipeline: any[] = [
      { $match: { schoolId } },
      { $unwind: "$entries" },
      {
        $match: {
          "entries.type": "credit",
          "entries.sourcePaymentId": { $ne: null },
        },
      },
      { $group: { _id: "$entries.sourcePaymentId" } },
    ];
    if (studentId) {
      creditPipeline[0].$match.studentId = studentId;
    }
    const blockedPaymentIdsRows = await StudentCreditBalance.aggregate(creditPipeline);
    const blockedPaymentIds = blockedPaymentIdsRows.map(
      (row: any) => row._id
    ) as mongoose.Types.ObjectId[];

    const pendingFilter = queueFilter("pending_approval", blockedPaymentIds);
    const unmatchedFilter = queueFilter("unmatched", blockedPaymentIds);
    const needsFilter = queueFilter("needs_reconciliation", blockedPaymentIds);
    const blockedFilter = queueFilter("reversal_blocked", blockedPaymentIds);

    const [
      pendingCount,
      unmatchedCount,
      needsCount,
      blockedCount,
      stalePendingCount,
      staleReconciliationCount,
      unreconciledCount,
      reversedCount,
      completedOrReversedCount,
      approvalLagRows,
    ] = await Promise.all([
      Payment.countDocuments({ ...baseQuery, ...pendingFilter }),
      Payment.countDocuments({ ...baseQuery, ...unmatchedFilter }),
      Payment.countDocuments({ ...baseQuery, ...needsFilter }),
      Payment.countDocuments({ ...baseQuery, ...blockedFilter }),
      Payment.countDocuments({
        ...baseQuery,
        ...pendingFilter,
        createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      Payment.countDocuments({
        ...baseQuery,
        status: "completed",
        reconciliationStatus: { $ne: "fully_reconciled" },
        paymentDate: { $lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      }),
      Payment.countDocuments({
        ...baseQuery,
        status: "completed",
        reconciliationStatus: { $ne: "fully_reconciled" },
      }),
      Payment.countDocuments({ ...baseQuery, status: "reversed" }),
      Payment.countDocuments({
        ...baseQuery,
        status: { $in: ["completed", "reversed"] },
      }),
      Payment.aggregate([
        {
          $match: {
            ...baseQuery,
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

    const selectedQueueFilter = queueFilter(queue, blockedPaymentIds);
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      Payment.find({ ...baseQuery, ...selectedQueueFilter })
        .sort({ createdAt: -1, paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate("studentId", "firstName lastName admissionNo")
        .populate({
          path: "invoiceId",
          select: "invoiceNumber academicPeriodId",
          populate: {
            path: "academicPeriodId",
            select: "yearLabel term isCurrent",
          },
        })
        .populate("receivedBy", "name firstName lastName email")
        .lean(),
      Payment.countDocuments({ ...baseQuery, ...selectedQueueFilter }),
    ]);

    const reversalRatePct =
      completedOrReversedCount > 0
        ? Math.round((reversedCount / completedOrReversedCount) * 1000) / 10
        : 0;
    const avgApprovalLagHours = Number(approvalLagRows[0]?.avgLagHours || 0);

    const queueCounts: Record<QueueKey, number> = {
      pending_approval: pendingCount,
      unmatched: unmatchedCount,
      needs_reconciliation: needsCount,
      reversal_blocked: blockedCount,
    };

    const alerts: Array<{
      id: string;
      severity: "info" | "warning" | "critical";
      title: string;
      description: string;
      count: number;
      queue?: QueueKey;
    }> = [];
    if (stalePendingCount > 0) {
      alerts.push({
        id: "stale_pending_approvals",
        severity: "critical",
        title: "Pending approvals breached SLA",
        description:
          "These proof payments have waited over 24 hours and need immediate review.",
        count: stalePendingCount,
        queue: "pending_approval",
      });
    }
    if (staleReconciliationCount > 0) {
      alerts.push({
        id: "stale_reconciliation",
        severity: "warning",
        title: "Reconciliation queue aging",
        description:
          "Unreconciled completed payments older than 48 hours should be investigated.",
        count: staleReconciliationCount,
        queue: "needs_reconciliation",
      });
    }

    return NextResponse.json({
      queue,
      queues: (Object.keys(QUEUE_CONFIG) as QueueKey[]).map((key) => ({
        key,
        label: QUEUE_CONFIG[key].label,
        description: QUEUE_CONFIG[key].description,
        slaHours: QUEUE_CONFIG[key].slaHours,
        count: queueCounts[key],
      })),
      alerts,
      kpis: {
        unreconciledCount,
        averageApprovalLagHours:
          Math.round((avgApprovalLagHours || 0) * 10) / 10,
        reversalRatePct,
      },
      payments: payments.map((payment: any) => {
        const ageHours = hoursSince(payment.createdAt || payment.paymentDate);
        const slaHours = QUEUE_CONFIG[queue].slaHours;
        return {
          ...payment,
          _id: String(payment._id),
          ageHours: Math.round(ageHours * 10) / 10,
          ageDays: Math.floor(ageHours / 24),
          queue,
          slaBreached: slaHours > 0 ? ageHours > slaHours : false,
          studentId: payment.studentId
            ? {
                _id: String(payment.studentId._id),
                firstName: payment.studentId.firstName || "",
                lastName: payment.studentId.lastName || "",
                admissionNo: payment.studentId.admissionNo || "",
              }
            : null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (typeof error?.message === "string" && error.message.startsWith("Invalid ")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to load payment inbox" },
      { status: 500 }
    );
  }
}
