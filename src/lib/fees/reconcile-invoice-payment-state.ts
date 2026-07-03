import mongoose from "mongoose";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { allocateToInvoiceLineItems, type AllocationInput } from "@/lib/fees/allocateToInvoiceLineItems";

type ReconcileArgs = {
  schoolId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
};

type MutableLineItem = {
  _id: mongoose.Types.ObjectId | string;
  amountMinor: number;
  amountPaidMinor: number;
  amountOutstandingMinor: number;
  isFullyPaid: boolean;
  status: "pending" | "partially_paid" | "paid" | "overdue";
  displayOrder?: number;
  sortOrder?: number;
  createdAt?: Date;
  name?: string;
};

function canonicalPaymentKey(payment: {
  _id: mongoose.Types.ObjectId;
  paymentMethod?: string | null;
  paystackReference?: string | null;
}) {
  const paystackReference = payment.paystackReference?.trim();
  if (payment.paymentMethod === "paystack" && paystackReference) {
    return `paystack:${paystackReference}`;
  }
  return `payment:${String(payment._id)}`;
}

function applyAllocationToLineItems(
  lineItems: MutableLineItem[],
  allocations: AllocationInput[]
) {
  const byId = new Map(lineItems.map((item) => [String(item._id), item]));

  for (const allocation of allocations) {
    const lineItem = byId.get(String(allocation.invoiceLineItemId));
    if (!lineItem || allocation.amountMinor <= 0) continue;

    const currentPaidMinor = Math.max(0, Number(lineItem.amountPaidMinor || 0));
    const currentOutstandingMinor = Math.max(
      0,
      Number(lineItem.amountMinor || 0) - currentPaidMinor
    );
    const appliedMinor = Math.min(allocation.amountMinor, currentOutstandingMinor);
    if (appliedMinor <= 0) continue;

    lineItem.amountPaidMinor = Math.max(
      0,
      currentPaidMinor + appliedMinor
    );
    lineItem.amountOutstandingMinor = Math.max(
      0,
      Number(lineItem.amountMinor || 0) - lineItem.amountPaidMinor
    );
    lineItem.isFullyPaid = lineItem.amountOutstandingMinor <= 0;
    lineItem.status = lineItem.isFullyPaid
      ? "paid"
      : lineItem.amountPaidMinor > 0
        ? "partially_paid"
        : "pending";
  }
}

async function syncInstallmentsFromLineItems(lineItems: MutableLineItem[]) {
  if (lineItems.length === 0) return;

  const schedules = await InstallmentSchedule.find({
    invoiceLineItemId: { $in: lineItems.map((item) => item._id) },
  }).sort({ invoiceLineItemId: 1, installmentNumber: 1, dueDate: 1, createdAt: 1 });

  if (schedules.length === 0) return;

  const paidByLineItemId = new Map(
    lineItems.map((item) => [
      String(item._id),
      Math.max(0, Number(item.amountPaidMinor || 0)),
    ])
  );
  const remainingPaidByLineItemId = new Map(paidByLineItemId);
  const now = new Date();

  for (const schedule of schedules) {
    const lineItemId = String(schedule.invoiceLineItemId);
    const remainingPaid = Math.max(
      0,
      Number(remainingPaidByLineItemId.get(lineItemId) || 0)
    );
    const amountMinor = Math.max(0, Number(schedule.amountMinor || 0));
    const amountPaidMinor = Math.min(amountMinor, remainingPaid);
    const amountOutstandingMinor = Math.max(0, amountMinor - amountPaidMinor);

    schedule.amountPaidMinor = amountPaidMinor;
    schedule.amountOutstandingMinor = amountOutstandingMinor;
    schedule.status =
      amountOutstandingMinor <= 0
        ? "paid"
        : amountPaidMinor > 0
          ? "partially_paid"
          : schedule.dueDate && new Date(schedule.dueDate) < now
            ? "overdue"
            : "pending";

    remainingPaidByLineItemId.set(
      lineItemId,
      Math.max(0, remainingPaid - amountPaidMinor)
    );
  }

  await Promise.all(schedules.map((schedule) => schedule.save()));
}

export async function reconcileInvoicePaymentState(args: ReconcileArgs) {
  const invoice = await Invoice.findOne({
    _id: args.invoiceId,
    schoolId: args.schoolId,
  });

  if (!invoice) {
    return { invoice: null, canonicalPaymentIds: [] as mongoose.Types.ObjectId[] };
  }

  const rawLineItems = await InvoiceLineItem.find({ invoiceId: invoice._id })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean<MutableLineItem[]>();

  const lineItems = rawLineItems.map((item) => ({
    ...item,
    amountPaidMinor: 0,
    amountOutstandingMinor: Math.max(0, Number(item.amountMinor || 0)),
    isFullyPaid: Number(item.amountMinor || 0) <= 0,
    status: Number(item.amountMinor || 0) <= 0 ? "paid" : "pending",
  })) satisfies MutableLineItem[];

  const allPayments = await Payment.find({
    schoolId: args.schoolId,
    invoiceId: invoice._id,
    status: "completed",
    approvalStatus: { $ne: "pending" },
  })
    .sort({ paymentDate: 1, createdAt: 1, _id: 1 })
    .select("_id amountMinor paymentDate createdAt paymentMethod paystackReference")
    .lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        amountMinor?: number;
        paymentMethod?: string | null;
        paystackReference?: string | null;
      }>
    >();

  const seen = new Set<string>();
  const canonicalPayments = allPayments.filter((payment) => {
    const key = canonicalPaymentKey(payment);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const canonicalPaymentIds = canonicalPayments.map((payment) => payment._id);

  for (const payment of canonicalPayments) {
    const existingAllocations = await PaymentAllocation.find({ paymentId: payment._id })
      .sort({ createdAt: 1, _id: 1 })
      .lean<Array<{ invoiceLineItemId: mongoose.Types.ObjectId; amountMinor?: number }>>();

    const allocations =
      existingAllocations.length > 0
        ? existingAllocations.map((allocation) => ({
            invoiceLineItemId: String(allocation.invoiceLineItemId),
            amountMinor: Math.max(0, Number(allocation.amountMinor || 0)),
          }))
        : allocateToInvoiceLineItems({
            lineItems: lineItems.map((item) => ({
              ...item,
              _id: String(item._id),
              sortOrder: item.displayOrder ?? item.sortOrder,
            })),
            amountMinor: Math.max(0, Number(payment.amountMinor || 0)),
            mode: "auto",
          }).allocations;

    if (existingAllocations.length === 0 && allocations.length > 0) {
      await PaymentAllocation.bulkWrite(
        allocations.map((allocation) => ({
          updateOne: {
            filter: {
              paymentId: payment._id,
              invoiceLineItemId: new mongoose.Types.ObjectId(allocation.invoiceLineItemId),
              installmentScheduleId: null,
              installmentNumber: null,
            },
            update: {
              $setOnInsert: {
                paymentId: payment._id,
                invoiceLineItemId: new mongoose.Types.ObjectId(allocation.invoiceLineItemId),
                amountMinor: allocation.amountMinor,
                installmentScheduleId: null,
                installmentNumber: null,
                notes: null,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      ).catch((error) => {
        console.warn("Failed to backfill payment allocations", {
          invoiceId: String(invoice._id),
          paymentId: String(payment._id),
          error,
        });
      });
    }

    applyAllocationToLineItems(lineItems, allocations);
  }

  const totalAmountMinor = lineItems.reduce(
    (sum, item) => sum + Number(item.amountMinor || 0),
    0
  );
  const totalPaidMinor = lineItems.reduce(
    (sum, item) => sum + Number(item.amountPaidMinor || 0),
    0
  );
  const totalOutstandingMinor = Math.max(0, totalAmountMinor - totalPaidMinor);

  if (lineItems.length > 0) {
    await InvoiceLineItem.bulkWrite(
      lineItems.map((item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              amountPaidMinor: item.amountPaidMinor,
              amountOutstandingMinor: item.amountOutstandingMinor,
              isFullyPaid: item.isFullyPaid,
              status: item.status,
            },
          },
        },
      }))
    );
    await syncInstallmentsFromLineItems(lineItems);
  }

  invoice.totalAmountMinor = totalAmountMinor;
  invoice.totalPaidMinor = totalPaidMinor;
  invoice.totalOutstandingMinor = totalOutstandingMinor;
  invoice.status =
    totalOutstandingMinor <= 0
      ? "paid"
      : totalPaidMinor > 0
        ? "partially_paid"
        : invoice.status === "draft"
          ? "draft"
          : "issued";
  invoice.paidDate = totalOutstandingMinor <= 0 ? invoice.paidDate || new Date() : undefined;
  await invoice.save();

  return { invoice, canonicalPaymentIds };
}
