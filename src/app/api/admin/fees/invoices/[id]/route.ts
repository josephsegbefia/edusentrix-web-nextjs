// src/app/api/admin/fees/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { calculateInvoiceStatus } from "@/lib/fees/invoice-utils";
import { toMinorUnits, calculateInstallmentAmounts, validateAmountSum } from "@/lib/fees/money";
import mongoose from "mongoose";

function dayTime(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildInstallmentScheduleItems(
  item: any,
  invoiceDueDate: Date,
  totalAmountMinor: number
) {
  if (!item.allowsInstallments) return [];
  const installmentCount = Number(item.numberOfInstallments || 0);
  if (installmentCount < 2) return [];

  if (Array.isArray(item.installmentSchedule) && item.installmentSchedule.length > 0) {
    const schedules = item.installmentSchedule.map((scheduleItem: any, index: number) => ({
      installmentNumber: Number(scheduleItem.installmentNumber || index + 1),
      dueDate: new Date(scheduleItem.dueDate),
      amountMinor: toMinorUnits(Number(scheduleItem.amount)),
    }));
    const scheduledTotal = schedules.reduce(
      (sum: number, scheduleItem: any) => sum + Number(scheduleItem.amountMinor || 0),
      0
    );
    if (scheduledTotal !== totalAmountMinor) {
      throw new Error(
        `${item.name?.trim() || "Line item"} installment amounts must equal the line item total.`
      );
    }
    return schedules;
  }

  const amounts = calculateInstallmentAmounts(totalAmountMinor, installmentCount);
  return amounts.map((amountMinor, index) => {
    const dueDate = new Date(invoiceDueDate);
    dueDate.setDate(dueDate.getDate() + index * 30);
    return {
      installmentNumber: index + 1,
      dueDate,
      amountMinor,
    };
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("fees");
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

    const lineItemIds = lineItems.map((li: any) => li._id);
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
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();
  const session = await mongoose.startSession();

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
        { error: "Can only update draft bills" },
        { status: 400 }
      );
    }

    await session.withTransaction(async () => {
      const period = await AcademicPeriod.findOne({
        _id: invoice.academicPeriodId,
        schoolId,
      }).session(session);

      if (!period) {
        throw new Error("Academic period not found");
      }

      const lineItems = Array.isArray(body.lineItems) ? body.lineItems : null;
      const nextDueDate = body.dueDate ? new Date(body.dueDate) : invoice.dueDate;
      const periodEndTime = dayTime(period.endDate);

      if (lineItems) {
        if (lineItems.length === 0) {
          throw new Error("At least one line item is required");
        }

        for (const [index, item] of lineItems.entries()) {
          if (!item?.name || typeof item.name !== "string" || !item.name.trim()) {
            throw new Error(`Line item ${index + 1} needs a name`);
          }

          const amount = Number(item.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(`Line item ${index + 1} needs a valid amount`);
          }

          if (
            item.feeStructureId &&
            !mongoose.Types.ObjectId.isValid(item.feeStructureId)
          ) {
            throw new Error(`Line item ${index + 1} has an invalid fee structure`);
          }

          const scheduleItems = buildInstallmentScheduleItems(
            item,
            nextDueDate,
            toMinorUnits(Number(item.amount))
          );
          for (const scheduleItem of scheduleItems) {
            if (dayTime(scheduleItem.dueDate) > periodEndTime) {
              throw new Error(
                `Installment ${scheduleItem.installmentNumber} for ${item.name.trim()} would fall after the academic period end date. Adjust the bill due date or installment schedule.`
              );
            }
          }
        }

        const existingLineItems = await InvoiceLineItem.find({
          invoiceId: invoice._id,
        })
          .select("_id")
          .session(session)
          .lean();
        const existingLineItemIds = existingLineItems.map((item: any) => item._id);
        if (existingLineItemIds.length > 0) {
          await InstallmentSchedule.deleteMany({
            invoiceLineItemId: { $in: existingLineItemIds },
          }).session(session);
        }
        await InvoiceLineItem.deleteMany({ invoiceId: invoice._id }).session(session);

        const preparedLineItems = lineItems.map((item: any, idx: number) => {
          const amountMinor = toMinorUnits(Number(item.amount));
          return {
            invoiceId: invoice._id,
            feeStructureId: item.feeStructureId || null,
            name: item.name.trim(),
            description: item.description || null,
            amountMinor,
            displayOrder: idx + 1,
            allowsInstallments: Boolean(item.allowsInstallments),
            numberOfInstallments: item.allowsInstallments
              ? Number(item.numberOfInstallments || 0) || null
              : null,
            amountPaidMinor: 0,
            amountOutstandingMinor: amountMinor,
            isFullyPaid: false,
            status: "pending",
            isAdjustment: false,
          };
        });

        const createdLineItems = await InvoiceLineItem.insertMany(
          preparedLineItems,
          { session }
        );

        for (const [index, createdLineItem] of createdLineItems.entries()) {
          const sourceItem = lineItems[index];
          const scheduleItems = buildInstallmentScheduleItems(
            sourceItem,
            nextDueDate,
            Number(createdLineItem.amountMinor || 0)
          );
          if (!scheduleItems.length) continue;

          await InstallmentSchedule.insertMany(
            scheduleItems.map((scheduleItem) => ({
              invoiceLineItemId: createdLineItem._id,
              installmentNumber: scheduleItem.installmentNumber,
              dueDate: scheduleItem.dueDate,
              amountMinor: scheduleItem.amountMinor,
              amountPaidMinor: 0,
              amountOutstandingMinor: scheduleItem.amountMinor,
              status: "pending",
            })),
            { session }
          );
        }

        invoice.totalAmountMinor = createdLineItems.reduce(
          (sum, item) => sum + Number(item.amountMinor || 0),
          0
        );
        invoice.totalPaidMinor = 0;
        invoice.totalOutstandingMinor = invoice.totalAmountMinor;
        invoice.totalCreditAppliedMinor = 0;
      }

      if (body.dueDate !== undefined) {
        invoice.dueDate = nextDueDate;
      }
      if (body.notes !== undefined) {
        invoice.notes = body.notes || null;
      }
      if (body.terms !== undefined) {
        invoice.terms = body.terms || null;
      }

      await invoice.save({ session });

      await InvoiceEvent.create(
        [
          {
            invoiceId: invoice._id,
            schoolId,
            studentId: invoice.studentId,
            eventType: "line_item_adjusted",
            description: `Draft bill ${invoice.invoiceNumber} updated`,
            performedBy: userId || null,
          },
        ],
        { session }
      );
    });

    const updatedInvoice = await Invoice.findById(id)
      .populate("studentId", "firstName lastName middleName admissionNo")
      .populate("academicPeriodId", "yearLabel term startDate endDate")
      .lean();

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update bill",
      },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId } = await requireFinanceStaff();
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

      const period = await AcademicPeriod.findOne({
        _id: invoice.academicPeriodId,
        schoolId,
      }).session(session);

      if (!period) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Academic period not found" },
          { status: 404 }
        );
      }

      const periodEndTime = dayTime(period.endDate);

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
          const savedSchedule = await InstallmentSchedule.find({
            invoiceLineItemId: lineItemId,
          })
            .sort({ installmentNumber: 1 })
            .session(session)
            .lean();

          if (customSchedule && Array.isArray(customSchedule) && customSchedule.length > 0) {
            if (savedSchedule.length > 0) {
              await InstallmentSchedule.deleteMany({
                invoiceLineItemId: lineItemId,
              }).session(session);
            }
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
              if (dayTime(scheduleItem.dueDate) > periodEndTime) {
                await session.abortTransaction();
                return NextResponse.json(
                  {
                    error: `Installment due dates for ${lineItem.name} must be on or before the academic period end date.`,
                  },
                  { status: 400 }
                );
              }

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
          } else if (savedSchedule.length > 0) {
            const amountsMinor = savedSchedule.map((s: any) =>
              Number(s.amountMinor || 0)
            );
            if (!validateAmountSum(amountsMinor, lineItem.amountMinor)) {
              await session.abortTransaction();
              return NextResponse.json(
                {
                  error: `Installment amounts must equal line item total for ${lineItem.name}`,
                },
                { status: 400 }
              );
            }

            for (const scheduleItem of savedSchedule) {
              if (dayTime(scheduleItem.dueDate) > periodEndTime) {
                await session.abortTransaction();
                return NextResponse.json(
                  {
                    error: `Installment due dates for ${lineItem.name} must be on or before the academic period end date.`,
                  },
                  { status: 400 }
                );
              }
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

              if (dayTime(dueDate) > periodEndTime) {
                await session.abortTransaction();
                return NextResponse.json(
                  {
                    error: `Generated installment ${i + 1} for ${lineItem.name} would fall after the academic period end date. Adjust the invoice due date or installment schedule.`,
                  },
                  { status: 400 }
                );
              }

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
            description: `Bill ${invoice.invoiceNumber} issued`,
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

      const paymentCount = await Payment.countDocuments({
        invoiceId: invoice._id,
        status: { $ne: "failed" },
      }).session(session);

      if (paymentCount > 0) {
        await session.abortTransaction();
        return NextResponse.json(
          {
            error:
              "Bills with recorded payments cannot be withdrawn. Use an adjustment or credit note instead.",
          },
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
            description: `Bill ${invoice.invoiceNumber} withdrawn`,
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 });
    }

    const invoice = await Invoice.findOne({ _id: id, schoolId }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    if (invoice.status !== "cancelled") {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Only withdrawn bills can be deleted" },
        { status: 400 }
      );
    }

    const paymentCount = await Payment.countDocuments({
      invoiceId: invoice._id,
      status: { $ne: "failed" },
    }).session(session);

    if (paymentCount > 0) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Bills with recorded payments cannot be deleted" },
        { status: 400 }
      );
    }

    const lineItems = await InvoiceLineItem.find({ invoiceId: invoice._id })
      .select("_id")
      .session(session)
      .lean();
    const lineItemIds = lineItems.map((lineItem: any) => lineItem._id);

    if (lineItemIds.length > 0) {
      await InstallmentSchedule.deleteMany({
        invoiceLineItemId: { $in: lineItemIds },
      }).session(session);
    }
    await InvoiceLineItem.deleteMany({ invoiceId: invoice._id }).session(session);
    await InvoiceEvent.deleteMany({ invoiceId: invoice._id }).session(session);
    await Invoice.deleteOne({ _id: invoice._id, schoolId }).session(session);

    await session.commitTransaction();
    return NextResponse.json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting bill:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete bill" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
