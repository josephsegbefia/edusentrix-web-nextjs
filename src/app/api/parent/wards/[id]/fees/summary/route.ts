// src/app/api/parent/wards/[id]/fees/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { AcademicPeriod } from "@/models/AcademicPeriod";

type AcademicPeriodRow = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type InvoiceSummaryRow = {
  totalBilled?: number;
  totalPaid?: number;
  outstanding?: number;
  nextDueDate?: Date | null;
};

type PendingInvoiceRow = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: Date | null;
  status: string;
  description?: string;
};

type RecentPaymentRow = {
  _id: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  receiptNumber?: string;
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

    // Get overall summary
    const overallSummary = await Invoice.aggregate<InvoiceSummaryRow>([
      {
        $match: {
          studentId,
          schoolId: context.schoolId,
        },
      },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$amountPaid" },
          outstanding: { $sum: "$balanceDue" },
          nextDueDate: { $min: { $cond: [{ $gt: ["$balanceDue", 0] }, "$dueDate", null] } },
        },
      },
    ]);

    // Get pending invoices
    const pendingInvoices = await Invoice.find({
      studentId,
      schoolId: context.schoolId,
      status: { $in: ["pending", "partial", "overdue"] },
    })
      .select("_id invoiceNumber totalAmount amountPaid balanceDue dueDate status description")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean<PendingInvoiceRow[]>();

    // Get recent payments
    const recentPayments = await Payment.find({
      studentId,
      schoolId: context.schoolId,
      status: "completed",
    })
      .select("_id amount paymentMethod paymentDate receiptNumber")
      .sort({ paymentDate: -1 })
      .limit(10)
      .lean<RecentPaymentRow[]>();

    const overallRow = overallSummary[0];
    const overall = {
      totalBilled: overallRow?.totalBilled ?? 0,
      totalPaid: overallRow?.totalPaid ?? 0,
      outstanding: overallRow?.outstanding ?? 0,
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
    const invoices = pendingInvoices.map((inv) => ({
      id: String(inv._id),
      title: inv.description || `Invoice ${inv.invoiceNumber}`,
      amount: inv.totalAmount,
      balanceDue: inv.balanceDue,
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : new Date().toISOString(),
      status: inv.status as "pending" | "partial" | "paid" | "overdue",
    }));

    // Map payments to expected format
    const payments = recentPayments.map((pay) => ({
      id: String(pay._id),
      amount: pay.amount,
      date: pay.paymentDate.toISOString(),
      method: pay.paymentMethod,
      reference: pay.receiptNumber || `PAY-${String(pay._id).slice(-6).toUpperCase()}`,
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
