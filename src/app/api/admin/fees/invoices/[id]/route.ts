// src/app/api/admin/fees/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { calculateInvoiceStatus } from "@/lib/fees/invoice-utils";
import { toMinorUnits, calculateInstallmentAmounts, validateAmountSum } from "@/lib/fees/money";
import mongoose from "mongoose";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { id } = await params;

    const invoice = await Invoice.findOne({
      _id: id,
      schoolId,
    })
      .populate("studentId", "firstName lastName middleName admissionNo")
      .populate("academicPeriodId", "yearLabel term startDate endDate")
      .lean();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get line items
    const lineItems = await InvoiceLineItem.find({
      invoiceId: id,
    })
      .sort({ displayOrder: 1 })
      .lean();

    const lineItemIds = lineItems.map((li) => li._id);
    const installments = await InstallmentSchedule.find({
      invoiceLineItemId: { $in: lineItemIds },
    })
      .sort({ installmentNumber: 1 })
      .lean();

    const lineItemsWithInstallments = lineItems.map((li) => ({
      ...li,
      installments: installments.filter(
        (inst) => String(inst.invoiceLineItemId) === String(li._id)
      ),
    }));

    // Get payments
    const payments = await Payment.find({
      invoiceId: id,
    })
      .sort({ paymentDate: -1 })
      .populate("receivedBy", "name email")
      .lean();

    // Get allocations for each payment
    const paymentsWithAllocations = await Promise.all(
      payments.map(async (payment) => {
        const allocations = await PaymentAllocation.find({
          paymentId: payment._id,
        })
          .populate("invoiceLineItemId", "name amountMinor")
          .lean();
        return { ...payment, allocations };
      })
    );

    // Get events
    const events = await InvoiceEvent.find({
      invoiceId: id,
    })
      .sort({ createdAt: -1 })
      .populate("performedBy", "name email")
      .lean();

    return NextResponse.json({
      invoice: {
        ...invoice,
        lineItems: lineItemsWithInstallments,
        payments: paymentsWithAllocations,
        events,
      },
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { id } = await params;
    const body = await req.json();

    const invoice = await Invoice.findOne({
      _id: id,
      schoolId,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow updates if draft
    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Can only update draft invoices" },
        { status: 400 }
      );
    }

    // Update allowed fields
    if (body.dueDate !== undefined) {
      invoice.dueDate = new Date(body.dueDate);
    }
    if (body.notes !== undefined) {
      invoice.notes = body.notes || null;
    }
    if (body.terms !== undefined) {
      invoice.terms = body.terms || null;
    }

    await invoice.save();

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, installmentSchedules } = body;

    const invoice = await Invoice.findOne({
      _id: id,
      schoolId,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (action === "issue") {
      if (invoice.status !== "draft") {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Can only issue draft invoices" },
          { status: 400 }
        );
      }

      invoice.status = "issued";
      invoice.issueDate = new Date();
      await invoice.save({ session });

      // Create installment schedules for line items that allow installments
      const lineItems = await InvoiceLineItem.find({
        invoiceId: invoice._id,
      })
        .session(session)
        .lean();

      // Get custom installment schedules from request body
      const customSchedules = installmentSchedules || {};

      for (const lineItem of lineItems) {
        if (
          lineItem.allowsInstallments &&
          lineItem.numberOfInstallments &&
          lineItem.numberOfInstallments >= 2
        ) {
          // Check if custom schedule was provided for this line item
          const lineItemId = lineItem._id as mongoose.Types.ObjectId;
          const customSchedule = customSchedules[lineItemId.toString()];

          if (customSchedule && Array.isArray(customSchedule) && customSchedule.length > 0) {
            const amountsMinor = customSchedule.map((s: any) => toMinorUnits(s.amount));
            const totalMinor = lineItem.amountMinor;
            if (!validateAmountSum(amountsMinor, totalMinor)) {
              await session.abortTransaction();
              return NextResponse.json(
                {
                  error: `Installment amounts must equal line item total for ${lineItem.name}`,
                },
                { status: 400 }
              );
            }

            // Use custom schedule
            for (const scheduleItem of customSchedule) {
              await InstallmentSchedule.create(
                [
                  {
                    invoiceLineItemId: lineItemId,
                    installmentNumber: scheduleItem.installmentNumber,
                    dueDate: new Date(scheduleItem.dueDate),
                    amountMinor: toMinorUnits(scheduleItem.amount),
                    amountPaidMinor: 0,
                    amountOutstandingMinor: toMinorUnits(scheduleItem.amount),
                    status: "pending",
                  },
                ],
                { session }
              );
            }
          } else {
            // Auto-generate installments
            const installmentAmounts = calculateInstallmentAmounts(
              lineItem.amountMinor,
              lineItem.numberOfInstallments
            );

            const baseDate = invoice.dueDate || new Date();

            for (let i = 0; i < lineItem.numberOfInstallments; i++) {
              const dueDate = new Date(baseDate);
              // Spread installments over months (30 days apart)
              dueDate.setDate(dueDate.getDate() + i * 30);

              await InstallmentSchedule.create(
                [
                  {
                    invoiceLineItemId: lineItemId,
                    installmentNumber: i + 1,
                    dueDate,
                    amountMinor: installmentAmounts[i],
                    amountPaidMinor: 0,
                    amountOutstandingMinor: installmentAmounts[i],
                    status: "pending",
                  },
                ],
                { session }
              );
            }
          }
        }
      }

      // Create event
      await InvoiceEvent.create(
        [
          {
            invoiceId: invoice._id,
            schoolId,
            studentId: invoice.studentId,
            eventType: "issued",
            description: `Invoice ${invoice.invoiceNumber} issued`,
            performedBy: userId || null,
          },
        ],
        { session }
      );
    } else if (action === "cancel") {
      if (invoice.status === "cancelled") {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Invoice already cancelled" },
          { status: 400 }
        );
      }

      invoice.status = "cancelled";
      await invoice.save({ session });

      // Create event
      await InvoiceEvent.create(
        [
          {
            invoiceId: invoice._id,
            schoolId,
            studentId: invoice.studentId,
            eventType: "cancelled",
            description: `Invoice ${invoice.invoiceNumber} cancelled`,
            performedBy: userId || null,
          },
        ],
        { session }
      );
    } else {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await session.commitTransaction();

    const updatedInvoice = await Invoice.findById(id)
      .populate("studentId", "firstName lastName admissionNo")
      .populate("academicPeriodId", "yearLabel term")
      .lean();

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error processing invoice action:", error);
    return NextResponse.json(
      { error: "Failed to process invoice action" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
