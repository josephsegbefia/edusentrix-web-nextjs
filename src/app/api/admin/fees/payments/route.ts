/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance"; // create if missing
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { applyAllocationsToInvoice } from "@/lib/fees/applyAllocationsToInvoice";
import { formatMoney } from "@/lib/fees/money";

const BodySchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),

  amountMinor: z.number().int().positive(),
  paymentDate: z.string().min(1), // ISO
  paymentMethod: z.enum([
    "cash",
    "bank_transfer",
    "mobile_money",
    "paystack",
    "cheque",
    "other",
  ]),
  receiptNumber: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),

  status: z.enum(["completed", "pending_approval"]).default("completed"),

  allocationMode: z.enum(["auto", "manual"]).default("auto"),
  allocations: z
    .array(
      z.object({
        invoiceLineItemId: z.string().min(1),
        amountMinor: z.number().int().positive(),
      })
    )
    .optional(),
});

// One-time index fix - drop and recreate paystackReference index with correct config
let indexFixed = false;
async function fixPaystackReferenceIndex() {
  if (indexFixed) return;
  try {
    const indexes = await Payment.collection.getIndexes();
    const existingIndex = indexes.paystackReference_1;
    if (existingIndex && !existingIndex.partialFilterExpression) {
      // Drop old index
      await Payment.collection.dropIndex("paystackReference_1").catch(() => {
        // Ignore if already dropped
      });
      // Recreate with correct config
      await Payment.collection.createIndex(
        { paystackReference: 1 },
        {
          unique: true,
          sparse: true,
          partialFilterExpression: { paystackReference: { $ne: null } },
          name: "paystackReference_1",
        }
      );
      indexFixed = true;
    }
  } catch (error) {
    // Ignore errors, will retry next time
    console.warn("Failed to fix paystackReference index:", error);
  }
}

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();

  // Fix index if needed (one-time)
  await fixPaystackReferenceIndex();

  const body = BodySchema.parse(await req.json());

  const invoice = await Invoice.findOne({
    _id: new mongoose.Types.ObjectId(body.invoiceId),
    schoolId,
    studentId: body.studentId,
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch line items from separate collection
  const lineItems = await InvoiceLineItem.find({
    invoiceId: invoice._id,
  })
    .sort({ displayOrder: 1 })
    .lean();

  // Normalize IDs to strings for consistent comparison
  const normalizedLineItems = lineItems.map((li: any) => ({
    ...li,
    _id: String(li._id),
  }));

  const { allocations, allocatedMinor, unallocatedMinor } =
    allocateToInvoiceLineItems({
      lineItems: normalizedLineItems,
      amountMinor: body.amountMinor,
      mode: body.allocationMode,
      manualAllocations: body.allocations,
    });

  const paymentId = new mongoose.Types.ObjectId();

  // Store payment as subdoc so invoiceDetail continues to work
  const paymentSubdoc: any = {
    _id: paymentId,
    amountMinor: body.amountMinor,
    paymentDate: body.paymentDate,
    paymentMethod: body.paymentMethod,
    receiptNumber: body.receiptNumber,
    reference: body.reference,
    note: body.note,
    status: body.status,
    createdAt: new Date(),
    createdByUserId: userId ?? null,
    allocations: allocations.map((a) => ({
      _id: new mongoose.Types.ObjectId(),
      invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
      amountMinor: a.amountMinor,
    })),
  };

  invoice.payments = invoice.payments ?? [];
  invoice.payments.push(paymentSubdoc);

  let creditAddedMinor = 0;

  if (body.status === "completed") {
    // Apply to invoice line items NOW (posted)
    applyAllocationsToInvoice(invoice, allocations, {
      lineItems: normalizedLineItems,
    });

    // Persist updated line item balances
    const allocatedIds = new Set(allocations.map((a) => String(a.invoiceLineItemId)));
    const bulkUpdates = normalizedLineItems
      .filter((li: any) => allocatedIds.has(String(li._id)))
      .map((li: any) => {
        const amountPaidMinor = li.amountPaidMinor ?? 0;
        const amountOutstandingMinor =
          li.amountOutstandingMinor ??
          Math.max(0, (li.amountMinor ?? 0) - amountPaidMinor);
        const isFullyPaid = amountOutstandingMinor <= 0;
        const status = isFullyPaid
          ? "paid"
          : amountPaidMinor > 0
          ? "partially_paid"
          : "pending";

        return {
          updateOne: {
            filter: { _id: li._id },
            update: {
              $set: {
                amountPaidMinor,
                amountOutstandingMinor,
                isFullyPaid,
                status,
              },
            },
          },
        };
      });

    if (bulkUpdates.length > 0) {
      await InvoiceLineItem.bulkWrite(bulkUpdates);
    }

    // Overpayment => credit wallet line (separate ledger line)
    if (unallocatedMinor > 0) {
      creditAddedMinor = unallocatedMinor;

      await StudentCreditBalance.updateOne(
        { schoolId, studentId: body.studentId },
        {
          $inc: { balanceMinor: creditAddedMinor },
          $push: {
            entries: {
              type: "credit",
              amountMinor: creditAddedMinor,
              createdAt: new Date(),
              reason: "Overpayment",
              sourcePaymentId: paymentId,
            },
          },
        },
        { upsert: true }
      );

      await InvoiceEvent.create({
        schoolId,
        invoiceId: invoice._id,
        studentId: new mongoose.Types.ObjectId(body.studentId),
        eventType: "adjustment_added",
        description: `Credit added from overpayment: ${formatMoney(creditAddedMinor)}`,
        metadata: { amountMinor: creditAddedMinor, sourcePaymentId: paymentId },
        relatedPaymentId: paymentId,
        performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
      });
    }

    await InvoiceEvent.create({
      schoolId,
      invoiceId: invoice._id,
      studentId: new mongoose.Types.ObjectId(body.studentId),
      eventType: "payment_recorded",
      description: `Payment recorded: ${formatMoney(body.amountMinor)} via ${body.paymentMethod}`,
      metadata: {
        paymentId,
        amountMinor: body.amountMinor,
        allocatedMinor,
        unallocatedMinor,
        paymentMethod: body.paymentMethod,
      },
      relatedPaymentId: paymentId,
      performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
    });
  } else {
    // pending_approval => DO NOT alter invoice totals/outstanding
    await InvoiceEvent.create({
      schoolId,
      invoiceId: invoice._id,
      studentId: new mongoose.Types.ObjectId(body.studentId),
      eventType: "payment_recorded",
      description: `Payment pending approval: ${formatMoney(body.amountMinor)} via ${body.paymentMethod}`,
      metadata: {
        paymentId,
        amountMinor: body.amountMinor,
        allocationMode: body.allocationMode,
        paymentMethod: body.paymentMethod,
      },
      relatedPaymentId: paymentId,
      performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
    });
  }

  // Create Payment record (for history + SSE + approvals)
  // Only include paystackReference if it exists to avoid unique index conflicts
  const paymentData: any = {
    _id: paymentId,
    schoolId: new mongoose.Types.ObjectId(schoolId),
    studentId: new mongoose.Types.ObjectId(body.studentId),
    invoiceId: invoice._id,
    amountMinor: body.amountMinor,
    paymentDate: new Date(body.paymentDate),
    paymentMethod: body.paymentMethod,
    receiptNumber: body.receiptNumber || null,
    notes: body.note || null,
    status: body.status === "completed" ? "completed" : "pending",
    approvalStatus: body.status === "completed" ? "not_required" : "pending",
    receivedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
    requestedAllocations:
      body.status === "pending_approval"
        ? allocations.map((a) => ({
            invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
            amountMinor: a.amountMinor,
            installmentScheduleId: null,
            installmentNumber: null,
            notes: null,
          }))
        : [],
  };

  // Only include paystackReference if it has a value (to avoid unique index issues with null)
  // Delete the property if not provided to ensure Mongoose doesn't set default null
  if (body.paystackReference && body.paystackReference.trim()) {
    paymentData.paystackReference = body.paystackReference.trim();
  } else {
    // Delete the property to ensure it's not included in the document
    delete paymentData.paystackReference;
  }

  // Ensure paystackReference is truly omitted if not provided (not null or undefined)
  // This prevents MongoDB unique index conflicts
  if (!paymentData.paystackReference) {
    delete paymentData.paystackReference;
  }

  const paymentDoc = await Payment.create(paymentData);

  // Persist allocations for completed payments (used by history + ledger)
  if (body.status === "completed" && allocations.length > 0) {
    await PaymentAllocation.insertMany(
      allocations.map((a) => ({
        paymentId: paymentDoc._id,
        invoiceLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
        amountMinor: a.amountMinor,
        installmentScheduleId: null,
        installmentNumber: null,
        notes: null,
      }))
    );
  }

  await invoice.save();

  return NextResponse.json({
    ok: true,
    paymentId: String(paymentId),
    invoiceId: String(invoice._id),
    allocatedMinor,
    unallocatedMinor,
    creditAddedMinor,
    status: body.status,
  });
}
