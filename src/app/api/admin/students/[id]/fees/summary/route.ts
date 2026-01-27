/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/fees/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { id: studentId } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify student exists
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(studentId),
      schoolId,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get current period
    const currentPeriodRaw = await AcademicPeriod.findOne({
      schoolId,
      isCurrent: true,
    }).lean();

    // Normalize currentPeriod (findOne().lean() can be inferred as array by TypeScript)
    const currentPeriod = (
      Array.isArray(currentPeriodRaw) ? currentPeriodRaw[0] || null : currentPeriodRaw
    ) as any;

    // Fetch all invoices
    const allInvoices = await Invoice.find({
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    })
      .populate("academicPeriodId", "yearLabel term isCurrent")
      .lean();

    // Calculate current period summary
    const currentPeriodId = currentPeriod?._id;
    const currentPeriodInvoices = currentPeriodId
      ? allInvoices.filter(
          (inv: any) =>
            String(inv.academicPeriodId?._id) === String(currentPeriodId)
        )
      : [];

    const currentPeriodSummary = {
      totalBilled: currentPeriodInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmountMinor || 0),
        0
      ),
      totalPaid: currentPeriodInvoices.reduce(
        (sum, inv) => sum + (inv.totalPaidMinor || 0),
        0
      ),
      totalOutstanding: currentPeriodInvoices.reduce(
        (sum, inv) => sum + (inv.totalOutstandingMinor || 0),
        0
      ),
      collectionRate:
        currentPeriodInvoices.length > 0
          ? Math.round(
              (currentPeriodInvoices.reduce(
                (sum, inv) => sum + (inv.totalPaidMinor || 0),
                0
              ) /
                currentPeriodInvoices.reduce(
                  (sum, inv) => sum + (inv.totalAmountMinor || 0),
                  0
                )) *
                100
            )
          : 0,
    };

    // Calculate all-time summary
    const allTimeSummary = {
      totalBilled: allInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmountMinor || 0),
        0
      ),
      totalPaid: allInvoices.reduce(
        (sum, inv) => sum + (inv.totalPaidMinor || 0),
        0
      ),
      totalOutstanding: allInvoices.reduce(
        (sum, inv) => sum + (inv.totalOutstandingMinor || 0),
        0
      ),
      collectionRate:
        allInvoices.length > 0
          ? Math.round(
              (allInvoices.reduce(
                (sum, inv) => sum + (inv.totalPaidMinor || 0),
                0
              ) /
                allInvoices.reduce(
                  (sum, inv) => sum + (inv.totalAmountMinor || 0),
                  0
                )) *
                100
            )
          : 0,
    };

    // Get credit balance
    const creditBalanceDoc = await StudentCreditBalance.findOne({
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    }).lean();

    const creditBalance =
      creditBalanceDoc && !Array.isArray(creditBalanceDoc)
        ? creditBalanceDoc.balanceMinor || 0
        : 0;

    // Get upcoming installments (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcomingInstallments = await InstallmentSchedule.find({
      invoiceLineItemId: {
        $in: await InvoiceLineItem.find({
          invoiceId: {
            $in: allInvoices.map((inv: any) => inv._id),
          },
        })
          .select("_id")
          .lean()
          .then((items) => items.map((item: any) => item._id)),
      },
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
      .lean();

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
    const periods = await AcademicPeriod.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    const previousPeriod =
      periods.length > 1 ? periods[1] : periods[0] === currentPeriod ? null : periods[0];

    let collectionRateTrend: "up" | "down" | "stable" = "stable";
    let averagePaymentTime = 0;
    let averagePaymentTimeTrend: "up" | "down" | "stable" = "stable";

    if (previousPeriod) {
      const previousInvoices = await Invoice.find({
        schoolId,
        studentId: new mongoose.Types.ObjectId(studentId),
        academicPeriodId: previousPeriod._id,
      }).lean();

      const previousTotalBilled = previousInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmountMinor || 0),
        0
      );
      const previousTotalPaid = previousInvoices.reduce(
        (sum, inv) => sum + (inv.totalPaidMinor || 0),
        0
      );
      const previousCollectionRate =
        previousTotalBilled > 0
          ? Math.round((previousTotalPaid / previousTotalBilled) * 100)
          : 0;

      if (currentPeriodSummary.collectionRate > previousCollectionRate) {
        collectionRateTrend = "up";
      } else if (currentPeriodSummary.collectionRate < previousCollectionRate) {
        collectionRateTrend = "down";
      }
    }

    // Calculate average payment time
    const completedPayments = await Payment.find({
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
      status: "completed",
    })
      .populate("invoiceId", "issueDate")
      .lean();

    let totalDays = 0;
    let countWithIssueDate = 0;
    for (const p of completedPayments) {
      const invoice = p.invoiceId as any;
      if (invoice?.issueDate && p.paymentDate) {
        const days =
          (new Date(p.paymentDate).getTime() -
            new Date(invoice.issueDate).getTime()) /
          (1000 * 60 * 60 * 24);
        totalDays += days;
        countWithIssueDate++;
      }
    }

    averagePaymentTime =
      countWithIssueDate > 0 ? Math.round(totalDays / countWithIssueDate) : 0;

    // Period breakdown
    const periodBreakdown = await Promise.all(
      periods.map(async (period: any) => {
        const periodInvoices = await Invoice.find({
          schoolId,
          studentId: new mongoose.Types.ObjectId(studentId),
          academicPeriodId: period._id,
        }).lean();

        const periodTotalBilled = periodInvoices.reduce(
          (sum, inv) => sum + (inv.totalAmountMinor || 0),
          0
        );
        const periodTotalPaid = periodInvoices.reduce(
          (sum, inv) => sum + (inv.totalPaidMinor || 0),
          0
        );

        return {
          periodId: String(period._id),
          periodLabel: `${period.yearLabel} • ${period.term}`,
          totalBilled: periodTotalBilled,
          totalPaid: periodTotalPaid,
          totalOutstanding: periodTotalBilled - periodTotalPaid,
          collectionRate:
            periodTotalBilled > 0
              ? Math.round((periodTotalPaid / periodTotalBilled) * 100)
              : 0,
        };
      })
    );

    return NextResponse.json({
      currentPeriod: currentPeriodSummary,
      allTime: allTimeSummary,
      creditBalance,
      upcomingInstallments: upcomingInstallmentsSummary,
      trends: {
        collectionRateTrend,
        averagePaymentTime,
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
