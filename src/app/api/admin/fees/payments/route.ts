// src/app/api/admin/fees/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { toMinorUnits, validateAmountSum } from "@/lib/fees/money";
import { updateLineItemTotals, calculateInvoiceTotals, calculateInvoiceStatus } from "@/lib/fees/invoice-utils";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const invoiceId = searchParams.get("invoiceId");
    const paymentMethod = searchParams.get("paymentMethod");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    const query: any = { schoolId, status: "completed" };

    if (studentId) {
      query.studentId = new mongoose.Types.ObjectId(studentId);
    }
    if (invoiceId) {
      query.invoiceId = new mongoose.Types.ObjectId(invoiceId);
    }
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
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

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate("studentId", "firstName lastName admissionNo")
        .populate("invoiceId", "invoiceNumber")
        .populate("receivedBy", "name email")
        .lean(),
      Payment.countDocuments(query),
    ]);

    // Get allocations for each payment
    const paymentsWithAllocations = await Promise.all(
      payments.map(async (payment: any) => {
        const allocations = await PaymentAllocation.find({
          paymentId: payment._id,
        })
          .populate("invoiceLineItemId", "name amountMinor")
          .lean();
        return { ...payment, allocations };
      })
    );

    return NextResponse.json({
      payments: paymentsWithAllocations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const body = await req.json();
    const {
      invoiceId,
      amount,
      paymentMethod,
      allocations,
      paymentDate,
      notes,
      receiptNumber,
    } = body;

    // Validate required fields
    if (!invoiceId || !amount || !paymentMethod || !allocations || !Array.isArray(allocations)) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Invoice, amount, payment method, and allocations are required" },
        { status: 400 }
      );
    }

    const amountMinor = toMinorUnits(amount);

    // Validate allocations sum equals payment amount
    const allocationAmounts = allocations.map((a: any) => toMinorUnits(a.amount));
    if (!validateAmountSum(allocationAmounts, amountMinor)) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Allocation amounts must sum to payment amount" },
        { status: 400 }
      );
    }

    // Get invoice
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      schoolId,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "cancelled") {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Cannot record payment for cancelled invoice" },
        { status: 400 }
      );
    }

    // Generate receipt number if not provided
    const receiptNum = receiptNumber || `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Create payment
    const payment = await Payment.create(
      [
        {
          schoolId,
          studentId: invoice.studentId,
          invoiceId: invoice._id,
          amountMinor,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod,
          receiptNumber: receiptNum,
          notes: notes || null,
          receivedBy: userId || null,
          status: "completed",
          reconciliationStatus: "unmatched",
        },
      ],
      { session }
    );

    // Create allocations and update line items
    let overpaymentMinor = 0;
    const createdAllocations = [];

    for (const allocation of allocations) {
      const lineItemId = allocation.invoiceLineItemId;
      const allocationAmountMinor = toMinorUnits(allocation.amount);

      // Get line item
      const lineItem = await InvoiceLineItem.findById(lineItemId).session(session);
      if (!lineItem || lineItem.invoiceId.toString() !== invoiceId) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: `Invalid line item: ${lineItemId}` },
          { status: 400 }
        );
      }

      // Check if allocation exceeds outstanding amount
      if (allocationAmountMinor > lineItem.amountOutstandingMinor) {
        // This is an overpayment for this line item
        overpaymentMinor += allocationAmountMinor - lineItem.amountOutstandingMinor;
        // Allocate only up to outstanding amount
        const actualAllocationMinor = lineItem.amountOutstandingMinor;

        // Update line item
        const updated = updateLineItemTotals(lineItem, actualAllocationMinor);
        lineItem.amountPaidMinor = updated.amountPaidMinor;
        lineItem.amountOutstandingMinor = updated.amountOutstandingMinor;
        lineItem.isFullyPaid = updated.isFullyPaid;
        lineItem.status = updated.status;
        await lineItem.save({ session });

        // Create allocation
        const alloc = await PaymentAllocation.create(
          [
            {
              paymentId: payment[0]._id,
              invoiceLineItemId: lineItemId,
              amountMinor: actualAllocationMinor,
              installmentScheduleId: allocation.installmentScheduleId || null,
              installmentNumber: allocation.installmentNumber || null,
              notes: allocation.notes || null,
            },
          ],
          { session }
        );
        createdAllocations.push(alloc[0]);
      } else {
        // Normal allocation
        const updated = updateLineItemTotals(lineItem, allocationAmountMinor);
        lineItem.amountPaidMinor = updated.amountPaidMinor;
        lineItem.amountOutstandingMinor = updated.amountOutstandingMinor;
        lineItem.isFullyPaid = updated.isFullyPaid;
        lineItem.status = updated.status;
        await lineItem.save({ session });

        // Create allocation
        const alloc = await PaymentAllocation.create(
          [
            {
              paymentId: payment[0]._id,
              invoiceLineItemId: lineItemId,
              amountMinor: allocationAmountMinor,
              installmentScheduleId: allocation.installmentScheduleId || null,
              installmentNumber: allocation.installmentNumber || null,
              notes: allocation.notes || null,
            },
          ],
          { session }
        );
        createdAllocations.push(alloc[0]);
      }

      // Update installment schedule if applicable
      if (allocation.installmentScheduleId) {
        const schedule = await InstallmentSchedule.findById(
          allocation.installmentScheduleId
        ).session(session);
        if (schedule) {
          schedule.amountPaidMinor += toMinorUnits(allocation.amount);
          schedule.amountOutstandingMinor = schedule.amountMinor - schedule.amountPaidMinor;
          schedule.status =
            schedule.amountPaidMinor >= schedule.amountMinor
              ? "paid"
              : schedule.amountPaidMinor > 0
                ? "partially_paid"
                : "pending";
          await schedule.save({ session });
        }
      }
    }

    // Handle overpayment - create credit
    if (overpaymentMinor > 0) {
      let creditBalance = await StudentCreditBalance.findOne({
        schoolId,
        studentId: invoice.studentId,
      }).session(session);

      if (!creditBalance) {
        creditBalance = await StudentCreditBalance.create(
          [
            {
              schoolId,
              studentId: invoice.studentId,
              balanceMinor: 0,
              entries: [],
            },
          ],
          { session }
        )[0];
      }

      creditBalance.balanceMinor += overpaymentMinor;
      creditBalance.entries.push({
        type: "credit",
        amountMinor: overpaymentMinor,
        sourcePaymentId: payment[0]._id,
        reason: `Overpayment from payment ${receiptNum}`,
        createdAt: new Date(),
      });
      await creditBalance.save({ session });
    }

    // Recalculate invoice totals
    const lineItems = await InvoiceLineItem.find({
      invoiceId: invoice._id,
    }).session(session);

    const totals = calculateInvoiceTotals(
      lineItems.map((li) => ({
        amountMinor: li.amountMinor,
        amountPaidMinor: li.amountPaidMinor,
      }))
    );

    invoice.totalPaidMinor = totals.totalPaidMinor;
    invoice.totalOutstandingMinor = totals.totalOutstandingMinor;

    // Update invoice status
    invoice.status = calculateInvoiceStatus(
      invoice.totalPaidMinor,
      invoice.totalAmountMinor,
      lineItems,
      invoice.issueDate
    );

    if (invoice.status === "paid") {
      invoice.paidDate = new Date();
    }

    await invoice.save({ session });

    // Create invoice event
    await InvoiceEvent.create(
      [
        {
          invoiceId: invoice._id,
          schoolId,
          studentId: invoice.studentId,
          eventType: "payment_recorded",
          description: `Payment of ${amountMinor / 100} GHS recorded`,
          performedBy: userId || null,
          relatedPaymentId: payment[0]._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Fetch full payment with allocations
    const fullPayment = await Payment.findById(payment[0]._id)
      .populate("studentId", "firstName lastName")
      .populate("invoiceId", "invoiceNumber")
      .populate("receivedBy", "name email")
      .lean();

    const paymentAllocations = await PaymentAllocation.find({
      paymentId: payment[0]._id,
    })
      .populate("invoiceLineItemId", "name amountMinor")
      .lean();

    return NextResponse.json(
      {
        payment: { ...fullPayment, allocations: paymentAllocations },
        overpaymentMinor,
      },
      { status: 201 }
    );
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record payment" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
