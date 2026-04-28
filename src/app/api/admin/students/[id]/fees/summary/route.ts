/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/fees/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";

const ACTIVE_INVOICE_STATUSES = new Set([
  "issued",
  "partially_paid",
  "paid",
  "overdue",
]);

function summarizeInvoices(invoices: any[]) {
  const totalBilled = invoices.reduce(
    (sum, inv) => sum + Number(inv.totalAmountMinor || 0),
    0
  );
  const totalPaid = invoices.reduce(
    (sum, inv) => sum + Number(inv.totalPaidMinor || 0),
    0
  );
  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + Number(inv.totalOutstandingMinor || 0),
    0
  );
  const collectionRate =
    totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;

  return {
    totalBilled,
    totalPaid,
    totalOutstanding,
    collectionRate,
  };
}

function calculateAveragePaymentTime(payments: any[]) {
  let totalDays = 0;
  let sampleCount = 0;
  for (const payment of payments) {
    const invoice = payment.invoiceId as any;
    if (!invoice?.issueDate || !payment.paymentDate) continue;
    const days =
      (new Date(payment.paymentDate).getTime() -
        new Date(invoice.issueDate).getTime()) /
      (1000 * 60 * 60 * 24);
    totalDays += days;
    sampleCount++;
  }

  return {
    averageDays: sampleCount > 0 ? Math.round(totalDays / sampleCount) : 0,
    sampleCount,
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("fees");
  await connectToDatabase();

  try {
    const { id: studentId } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }
    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // Verify student exists
    const student = await Student.findOne({
      _id: studentObjectId,
      schoolId,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get periods in chronological order so "current vs previous" is deterministic.
    const periodsRaw = await AcademicPeriod.find({ schoolId })
      .sort({ startDate: 1, endDate: 1, createdAt: 1 })
      .lean();
    const periods = (Array.isArray(periodsRaw) ? periodsRaw : []) as any[];
    const currentPeriod =
      periods.find((period) => period.isCurrent) ??
      (periods.length > 0 ? periods[periods.length - 1] : null);
    const currentPeriodIndex = currentPeriod
      ? periods.findIndex(
          (period) => String(period._id) === String(currentPeriod._id)
        )
      : -1;
    const previousPeriod =
      currentPeriodIndex > 0 ? periods[currentPeriodIndex - 1] : null;

    // Fetch all invoices
    const allInvoicesRaw = await Invoice.find({
      schoolId,
      studentId: studentObjectId,
    })
      .populate("academicPeriodId", "yearLabel term isCurrent")
      .lean();
    const allInvoices = (Array.isArray(allInvoicesRaw)
      ? allInvoicesRaw
      : []) as any[];
    const activeInvoices = allInvoices.filter((invoice) =>
      ACTIVE_INVOICE_STATUSES.has(String(invoice.status))
    );

    // Calculate current period summary
    const currentPeriodId = currentPeriod?._id;
    const currentPeriodInvoices = currentPeriodId
      ? activeInvoices.filter(
          (inv: any) =>
            String(inv.academicPeriodId?._id) === String(currentPeriodId)
        )
      : [];
    const currentPeriodSummary = summarizeInvoices(currentPeriodInvoices);

    // Calculate all-time summary
    const allTimeSummary = summarizeInvoices(activeInvoices);

    // Get credit balance
    const creditBalanceDoc = await StudentCreditBalance.findOne({
      schoolId,
      studentId: studentObjectId,
    }).lean();

    const creditBalance =
      creditBalanceDoc && !Array.isArray(creditBalanceDoc)
        ? creditBalanceDoc.balanceMinor || 0
        : 0;

    // Get upcoming installments (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    const activeInvoiceIds = activeInvoices.map((invoice: any) => invoice._id);
    const invoiceLineItemIds = activeInvoiceIds.length
      ? await InvoiceLineItem.find({
          invoiceId: { $in: activeInvoiceIds },
        })
          .select("_id")
          .lean()
          .then((items) => items.map((item: any) => item._id))
      : [];

    const upcomingInstallments =
      invoiceLineItemIds.length > 0
        ? await InstallmentSchedule.find({
            invoiceLineItemId: { $in: invoiceLineItemIds },
            dueDate: { $gte: now, $lte: thirtyDaysFromNow },
            status: { $ne: "paid" },
          })
            .populate({
              path: "invoiceLineItemId",
              populate: {
                path: "invoiceId",
                select: "invoiceNumber academicPeriodId",
              },
            })
            .lean()
        : [];

    const upcomingInstallmentsSummary = {
      count: upcomingInstallments.length,
      totalAmount: upcomingInstallments.reduce(
        (sum, inst: any) => sum + (inst.amountOutstandingMinor || 0),
        0
      ),
      nextDueDate:
        upcomingInstallments.length > 0
          ? upcomingInstallments.sort(
              (a: any, b: any) =>
                new Date(a.dueDate).getTime() -
                new Date(b.dueDate).getTime()
            )[0].dueDate
          : null,
    };

    // Calculate trends (compare current period to previous)
    let collectionRateTrend: "up" | "down" | "stable" = "stable";
    let averagePaymentTime = 0;
    let averagePaymentTimeSampleCount = 0;
    let averagePaymentTimeTrend: "up" | "down" | "stable" = "stable";

    if (previousPeriod) {
      const previousPeriodInvoices = activeInvoices.filter(
        (invoice: any) =>
          String(invoice.academicPeriodId?._id) === String(previousPeriod._id)
      );
      const previousCollectionRate =
        summarizeInvoices(previousPeriodInvoices).collectionRate;

      if (currentPeriodSummary.collectionRate > previousCollectionRate) {
        collectionRateTrend = "up";
      } else if (currentPeriodSummary.collectionRate < previousCollectionRate) {
        collectionRateTrend = "down";
      }
    }

    // Calculate average payment time
    const completedPayments = await Payment.find(
      activeInvoiceIds.length > 0
        ? {
            schoolId,
            studentId: studentObjectId,
            status: "completed",
            invoiceId: { $in: activeInvoiceIds },
          }
        : {
            schoolId,
            studentId: studentObjectId,
            status: "completed",
          }
    )
      .populate("invoiceId", "issueDate academicPeriodId")
      .lean();

    const currentPeriodPayments =
      currentPeriod && currentPeriod._id
        ? completedPayments.filter((payment: any) => {
            const invoice = payment.invoiceId as any;
            return (
              invoice?.academicPeriodId &&
              String(invoice.academicPeriodId) === String(currentPeriod._id)
            );
          })
        : completedPayments;
    const currentAverageStats = calculateAveragePaymentTime(currentPeriodPayments);
    averagePaymentTime = currentAverageStats.averageDays;
    averagePaymentTimeSampleCount = currentAverageStats.sampleCount;

    if (previousPeriod && currentPeriod) {
      const previousPeriodPayments = completedPayments.filter((payment: any) => {
        const invoice = payment.invoiceId as any;
        return (
          invoice?.academicPeriodId &&
          String(invoice.academicPeriodId) === String(previousPeriod._id)
        );
      });
      const previousAverageStats =
        calculateAveragePaymentTime(previousPeriodPayments);
      if (
        currentAverageStats.sampleCount > 0 &&
        previousAverageStats.sampleCount > 0
      ) {
        if (averagePaymentTime < previousAverageStats.averageDays) {
          averagePaymentTimeTrend = "up";
        } else if (averagePaymentTime > previousAverageStats.averageDays) {
          averagePaymentTimeTrend = "down";
        }
      }
    }

    // Period breakdown (last 6 periods, chronological)
    const periodsForBreakdown = periods.slice(-6);
    const periodBreakdown = periodsForBreakdown.map((period: any) => {
      const periodInvoices = activeInvoices.filter(
        (invoice: any) =>
          String(invoice.academicPeriodId?._id) === String(period._id)
      );
      const summary = summarizeInvoices(periodInvoices);

      return {
        periodId: String(period._id),
        periodLabel: `${period.yearLabel} • ${period.term}`,
        totalBilled: summary.totalBilled,
        totalPaid: summary.totalPaid,
        totalOutstanding: summary.totalOutstanding,
        collectionRate: summary.collectionRate,
      };
    });

    return NextResponse.json({
      currentPeriod: currentPeriodSummary,
      allTime: allTimeSummary,
      creditBalance,
      upcomingInstallments: upcomingInstallmentsSummary,
      trends: {
        collectionRateTrend,
        averagePaymentTime,
        averagePaymentTimeSampleCount,
        averagePaymentTimeTrend,
      },
      periodBreakdown,
    });
  } catch (error) {
    console.error("Error fetching student fees summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
