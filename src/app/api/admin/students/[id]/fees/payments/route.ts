/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/fees/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { Student } from "@/models/Student";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { id: studentId } = await ctx.params;
    const { searchParams } = new URL(req.url);

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify student exists and belongs to school
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

    // Parse query parameters
    const invoiceId = searchParams.get("invoiceId");
    const paymentMethod = searchParams.get("paymentMethod");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    // Build query
    const query: any = {
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    };

    if (invoiceId) {
      query.invoiceId = new mongoose.Types.ObjectId(invoiceId);
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (status) {
      query.status = status;
    }

    if (dateFrom || dateTo) {
      query.paymentDate = {};
      if (dateFrom) {
        query.paymentDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.paymentDate.$lte = new Date(dateTo);
      }
    }

    const skip = (page - 1) * limit;

    // Payments are stored in the Payment collection
    // Build payment query
    const paymentQuery: any = {
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    };

    if (invoiceId) {
      paymentQuery.invoiceId = new mongoose.Types.ObjectId(invoiceId);
    }

    if (paymentMethod) {
      paymentQuery.paymentMethod = paymentMethod;
    }

    if (status) {
      paymentQuery.status = status;
    }

    if (dateFrom || dateTo) {
      paymentQuery.paymentDate = {};
      if (dateFrom) {
        paymentQuery.paymentDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        paymentQuery.paymentDate.$lte = new Date(dateTo);
      }
    }

    // Fetch payments from Payment collection
    const [payments, total] = await Promise.all([
      Payment.find(paymentQuery)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("invoiceId", "invoiceNumber academicPeriodId issueDate")
        .lean(),
      Payment.countDocuments(paymentQuery),
    ]);

    // Fetch allocations for payments (if PaymentAllocation collection exists)
    const paymentIds = payments.map((p: any) => p._id);
    let allocations: any[] = [];
    if (paymentIds.length > 0) {
      try {
        allocations = await PaymentAllocation.find({
          paymentId: { $in: paymentIds },
        })
          .populate("invoiceLineItemId", "name")
          .lean();
      } catch {
        // PaymentAllocation might not exist, continue without allocations
      }
    }

    const allocationsByPaymentId = new Map<string, any[]>();
    for (const alloc of allocations) {
      const pid = String(alloc.paymentId);
      if (!allocationsByPaymentId.has(pid)) {
        allocationsByPaymentId.set(pid, []);
      }
      allocationsByPaymentId.get(pid)!.push(alloc);
    }

    // Calculate summary - only count completed payments
    // Query all completed payments for the student (ignoring filters for summary)
    const summaryQuery: any = {
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
      status: "completed",
    };

    const completedPayments = await Payment.find(summaryQuery)
      .populate("invoiceId", "issueDate")
      .lean();

    const totalPaid = completedPayments.reduce(
      (sum, p) => sum + (p.amountMinor || 0),
      0
    );

    // Calculate average payment time (days from invoice issue to payment)
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

    const averagePaymentTime =
      countWithIssueDate > 0 ? Math.round(totalDays / countWithIssueDate) : 0;

    // Payment method breakdown
    const paymentMethodBreakdown: Record<string, number> = {};
    for (const p of completedPayments) {
      const method = p.paymentMethod || "unknown";
      paymentMethodBreakdown[method] =
        (paymentMethodBreakdown[method] || 0) + (p.amountMinor || 0);
    }

    return NextResponse.json({
      payments: payments.map((p: any) => ({
        ...p,
        _id: String(p._id),
        studentId: String(p.studentId),
        schoolId: String(p.schoolId),
        invoiceId: p.invoiceId
          ? {
              _id: String(p.invoiceId._id),
              invoiceNumber: p.invoiceId.invoiceNumber || "",
              academicPeriodId: p.invoiceId.academicPeriodId
                ? String(p.invoiceId.academicPeriodId)
                : null,
            }
          : null,
        allocations: allocationsByPaymentId.get(String(p._id)) || [],
      })),
      summary: {
        totalPaid,
        paymentCount: completedPayments.length, // Already filtered to completed payments
        averagePaymentTime,
        paymentMethodBreakdown,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching student payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
