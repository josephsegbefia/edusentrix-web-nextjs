// src/app/api/parent/wards/[id]/fees/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { toMajorUnits } from "@/lib/fees/money";
import { getPaystackKeyMode } from "@/lib/paystack";
import { isSchoolPaymentReady } from "@/lib/school-payments/payment-setup";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { School } from "@/models/School";

type AcademicPeriodRow = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type InvoiceSummaryRow = {
  totalBilledMinor?: number;
  totalPaidMinor?: number;
  outstandingMinor?: number;
  nextDueDate?: Date | null;
};

type PendingInvoiceRow = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber?: string;
  totalAmountMinor?: number;
  totalPaidMinor?: number;
  totalOutstandingMinor?: number;
  dueDate: Date | null;
  status?: string;
  notes?: string | null;
};

type RecentPaymentRow = {
  _id: mongoose.Types.ObjectId;
  amountMinor?: number;
  paymentMethod?: string;
  paymentDate?: Date;
  paystackReference?: string | null;
  externalReference?: string | null;
  internalReference?: string | null;
  receiptNumber?: string | null;
};

type SchoolPaymentRow = {
  bank?: {
    bankName?: string | null;
    branchName?: string | null;
    sortCode?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
  } | null;
  billing?: {
    status?: "unprovisioned" | "provisioned" | "failed" | null;
    paymentSetup?: {
      status?:
        | "not_started"
        | "awaiting_billing_owner"
        | "details_submitted"
        | "pending_provisioning"
        | "review_required"
        | "provisioned"
        | "failed"
        | null;
      ownerUserId?: mongoose.Types.ObjectId | null;
      ownerName?: string | null;
      ownerEmail?: string | null;
    } | null;
    paystack?: {
      subaccountCode?: string | null;
      subaccountId?: string | null;
      lastError?: string | null;
    } | null;
  } | null;
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify guardian access
    await verifyGuardianAccess(context.userId, id);

    const studentId = new mongoose.Types.ObjectId(id);

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id name")
      .lean<AcademicPeriodRow | null>();
    const school = await School.findById(context.schoolId)
      .select("bank billing")
      .lean<SchoolPaymentRow | null>();
    const canPayOnline = school ? isSchoolPaymentReady(school) : false;
    const paystackKeyMode = getPaystackKeyMode();
    const onlinePaymentsReady = canPayOnline;

    // Get overall summary
    const overallSummary = await Invoice.aggregate<InvoiceSummaryRow>([
      {
        $match: {
          studentId,
          schoolId: context.schoolId,
          status: { $nin: ["draft", "cancelled"] },
        },
      },
      {
        $group: {
          _id: null,
          totalBilledMinor: { $sum: "$totalAmountMinor" },
          totalPaidMinor: { $sum: "$totalPaidMinor" },
          outstandingMinor: { $sum: "$totalOutstandingMinor" },
          nextDueDate: {
            $min: { $cond: [{ $gt: ["$totalOutstandingMinor", 0] }, "$dueDate", null] },
          },
        },
      },
    ]);

    // Get pending invoices
    const pendingInvoices = await Invoice.find({
      studentId,
      schoolId: context.schoolId,
      status: { $nin: ["draft", "cancelled"] },
      totalOutstandingMinor: { $gt: 0 },
    })
      .select("_id invoiceNumber totalAmountMinor totalPaidMinor totalOutstandingMinor dueDate status notes")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean<PendingInvoiceRow[]>();

    // Get recent payments
    const recentPayments = await Payment.find({
      studentId,
      schoolId: context.schoolId,
      status: "completed",
    })
      .select(
        "_id amountMinor paymentMethod paymentDate paystackReference externalReference internalReference receiptNumber"
      )
      .sort({ paymentDate: -1 })
      .limit(10)
      .lean<RecentPaymentRow[]>();

    const overallRow = overallSummary[0];
    const overall = {
      totalBilled: toMajorUnits(Number(overallRow?.totalBilledMinor || 0)),
      totalPaid: toMajorUnits(Number(overallRow?.totalPaidMinor || 0)),
      outstanding: toMajorUnits(Number(overallRow?.outstandingMinor || 0)),
      nextDueDate: overallRow?.nextDueDate ?? null,
    };

    const feeStatus: "clear" | "partial" | "owing" =
      overall.outstanding === 0
        ? "clear"
        : overall.totalPaid > 0
        ? "partial"
        : "owing";

    const paymentProgress = overall.totalBilled > 0
      ? Math.round((overall.totalPaid / overall.totalBilled) * 100)
      : 100;

    // Map invoices to expected format
    const invoices = pendingInvoices.map((inv) => {
      const invoiceStatus = String(inv.status || "issued");
      const amount = toMajorUnits(Number(inv.totalAmountMinor || 0));
      const balanceDue = toMajorUnits(Number(inv.totalOutstandingMinor || 0));

      const status: "pending" | "partial" | "paid" | "overdue" =
        balanceDue <= 0
          ? "paid"
          : invoiceStatus === "overdue"
            ? "overdue"
            : invoiceStatus === "partially_paid"
              ? "partial"
              : "pending";

      return {
        id: String(inv._id),
        invoiceNumber: inv.invoiceNumber || "School Fees",
        title: inv.invoiceNumber || "School Fees",
        amount,
        amountMinor: Number(inv.totalAmountMinor || 0),
        balanceDue,
        balanceDueMinor: Number(inv.totalOutstandingMinor || 0),
        dueDate: inv.dueDate ? inv.dueDate.toISOString() : new Date().toISOString(),
        status,
        canPayOnline,
      };
    });

    // Map payments to expected format
    const payments = recentPayments.map((pay) => ({
      id: String(pay._id),
      amount: toMajorUnits(Number(pay.amountMinor || 0)),
      date: pay.paymentDate?.toISOString() || new Date().toISOString(),
      method: pay.paymentMethod || "other",
      reference:
        pay.paystackReference ||
        pay.externalReference ||
        pay.internalReference ||
        pay.receiptNumber ||
        `PAY-${String(pay._id).slice(-6).toUpperCase()}`,
    }));

    return NextResponse.json({
      success: true,
      data: {
        // Format expected by the frontend hook
        status: feeStatus,
        totalFees: overall.totalBilled,
        amountPaid: overall.totalPaid,
        balanceDue: overall.outstanding,
        paymentProgress,
        nextDueDate: overall.nextDueDate?.toISOString() || null,
        invoices,
        payments,
        // Additional context
        currentPeriod: currentPeriod
          ? {
              periodId: String(currentPeriod._id),
              periodName: currentPeriod.name,
            }
          : null,
        paystackKeyMode,
        onlinePaymentsReady,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch ward fees summary:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch fees summary",
      },
      { status: 500 }
    );
  }
}
