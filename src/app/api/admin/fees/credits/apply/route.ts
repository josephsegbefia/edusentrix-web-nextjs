import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { applyAllocationsToInvoice } from "@/lib/fees/applyAllocationsToInvoice";
import { formatMoney } from "@/lib/fees/money";

const BodySchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  note: z.string().optional(),

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

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();

  const body = BodySchema.parse(await req.json());

  const credit = await StudentCreditBalance.findOne({
    schoolId,
    studentId: body.studentId,
  });
  const balanceMinor = credit?.balanceMinor ?? 0;

  if (balanceMinor < body.amountMinor) {
    return NextResponse.json(
      { error: "Insufficient credit balance" },
      { status: 400 }
    );
  }

  const invoice = await Invoice.findOne({
    _id: new mongoose.Types.ObjectId(body.invoiceId),
    schoolId,
    studentId: body.studentId,
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const lineItems = await InvoiceLineItem.find({
    invoiceId: invoice._id,
  })
    .sort({ displayOrder: 1 })
    .lean();

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

  // If credit amount > outstanding (auto mode), any remainder should stay as credit (do not burn it)
  // So we only apply the allocated amount.
  const appliedMinor = allocatedMinor; // what actually reduced invoice

  if (appliedMinor <= 0) {
    return NextResponse.json(
      { error: "Nothing to apply (invoice may already be settled)" },
      { status: 400 }
    );
  }

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

  // Deduct only applied amount
  await StudentCreditBalance.updateOne(
    { schoolId, studentId: body.studentId },
    {
      $inc: { balanceMinor: -appliedMinor },
      $push: {
        entries: allocations.map((a) => ({
          type: "application",
          amountMinor: a.amountMinor,
          createdAt: new Date(),
          reason: body.note ?? "Credit applied",
          appliedToInvoiceId: invoice._id,
          appliedToLineItemId: new mongoose.Types.ObjectId(a.invoiceLineItemId),
          createdByUserId: userId ?? null,
        })),
      },
    }
  );

  await InvoiceEvent.create({
    schoolId,
    invoiceId: invoice._id,
    studentId: new mongoose.Types.ObjectId(body.studentId),
    eventType: "credit_applied",
    description: `Credit applied: ${formatMoney(appliedMinor)}${body.note ? ` - ${body.note}` : ""}`,
    metadata: { appliedMinor, note: body.note ?? null },
    performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
  });

  await invoice.save();

  return NextResponse.json({
    ok: true,
    invoiceId: String(invoice._id),
    appliedMinor,
    unallocatedMinor, // remains as credit (not deducted)
  });
}
