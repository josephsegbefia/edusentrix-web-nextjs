import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { AcademicPeriod } from "@/models/AcademicPeriod";

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
      .lean();

    // Get overall summary
    const overallSummary = await Invoice.aggregate([
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
        },
      },
    ]);

    // Get current period summary
    let currentPeriodSummary = null;
    if (currentPeriod) {
      const periodSummary = await Invoice.aggregate([
        {
          $match: {
            studentId,
            schoolId: context.schoolId,
            academicPeriodId: (currentPeriod as any)._id,
          },
        },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$amountPaid" },
            outstanding: { $sum: "$balanceDue" },
          },
        },
      ]);

      currentPeriodSummary = periodSummary[0] || {
        totalBilled: 0,
        totalPaid: 0,
        outstanding: 0,
      };
    }

    // Get pending invoices
    const pendingInvoices = await Invoice.find({
      studentId,
      schoolId: context.schoolId,
      status: { $in: ["pending", "partial"] },
    })
      .select("_id invoiceNumber totalAmount amountPaid balanceDue dueDate status")
      .sort({ dueDate: 1 })
      .limit(5)
      .lean();

    // Get recent payments
    const recentPayments = await Payment.find({
      studentId,
      schoolId: context.schoolId,
    })
      .select("_id amount paymentMethod paymentDate receiptNumber")
      .sort({ paymentDate: -1 })
      .limit(5)
      .lean();

    const overall = overallSummary[0] || {
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
    };

    const feeStatus: "clear" | "partial" | "owing" =
      overall.outstanding === 0
        ? "clear"
        : overall.totalPaid > 0
        ? "partial"
        : "owing";

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          totalBilled: overall.totalBilled,
          totalPaid: overall.totalPaid,
          outstanding: overall.outstanding,
          status: feeStatus,
        },
        currentPeriod: currentPeriodSummary
          ? {
              periodId: String((currentPeriod as any)._id),
              periodName: (currentPeriod as any).name,
              totalBilled: currentPeriodSummary.totalBilled,
              totalPaid: currentPeriodSummary.totalPaid,
              outstanding: currentPeriodSummary.outstanding,
            }
          : null,
        pendingInvoices: pendingInvoices.map((inv: any) => ({
          id: String(inv._id),
          invoiceNumber: inv.invoiceNumber,
          totalAmount: inv.totalAmount,
          amountPaid: inv.amountPaid,
          balanceDue: inv.balanceDue,
          dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
          status: inv.status,
        })),
        recentPayments: recentPayments.map((pay: any) => ({
          id: String(pay._id),
          amount: pay.amount,
          paymentMethod: pay.paymentMethod,
          paymentDate: pay.paymentDate ? pay.paymentDate.toISOString() : null,
          receiptNumber: pay.receiptNumber || null,
        })),
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
