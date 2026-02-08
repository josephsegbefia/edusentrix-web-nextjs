// src/app/api/admin/fees/invoices/[id]/adjustments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { calculateInvoiceTotals, calculateInvoiceStatus } from "@/lib/fees/invoice-utils";
import { toMinorUnits } from "@/lib/fees/money";
import mongoose from "mongoose";

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
    const { lineItems } = body as {
      lineItems: Array<{
        name: string;
        description?: string;
        amount: number;
        adjustmentType: "waiver" | "scholarship" | "correction" | "penalty" | "other";
        adjustmentReason: string;
      }>;
    };

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "At least one adjustment line item is required" },
        { status: 400 }
      );
    }

    const invoice = await Invoice.findOne({
      _id: id,
      schoolId,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "cancelled") {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Cannot add adjustments to a cancelled invoice" },
        { status: 400 }
      );
    }

    const currentLineItems = await InvoiceLineItem.find({
      invoiceId: id,
    })
      .sort({ displayOrder: -1 })
      .session(session)
      .lean();

    let nextDisplayOrder =
      currentLineItems.length > 0 ? (currentLineItems[0].displayOrder || 0) + 1 : 1;

    const createdAdjustments = [];

    for (const item of lineItems) {
      const amountMinor = toMinorUnits(item.amount);
      const adjustment = await InvoiceLineItem.create(
        [
          {
            invoiceId: invoice._id,
            name: item.name,
            description: item.description || null,
            amountMinor,
            displayOrder: nextDisplayOrder++,
            allowsInstallments: false,
            numberOfInstallments: null,
            amountPaidMinor: 0,
            amountOutstandingMinor: 0,
            isFullyPaid: true,
            status: "paid",
            isAdjustment: true,
            adjustmentType: item.adjustmentType,
            adjustmentReason: item.adjustmentReason,
            adjustedBy: userId || null,
          },
        ],
        { session }
      );
      createdAdjustments.push(adjustment[0]);
    }

    // Recalculate totals with all line items (including adjustments)
    const allLineItems = await InvoiceLineItem.find({
      invoiceId: invoice._id,
    }).session(session);

    const totals = calculateInvoiceTotals(
      allLineItems.map((li) => ({
        amountMinor: li.amountMinor,
        amountPaidMinor: li.amountPaidMinor,
      }))
    );

    invoice.totalAmountMinor = totals.totalAmountMinor;
    invoice.totalOutstandingMinor = Math.max(totals.totalOutstandingMinor, 0);
    invoice.version = (invoice.version || 1) + 1;

    invoice.status = calculateInvoiceStatus(
      invoice.totalPaidMinor,
      invoice.totalAmountMinor,
      allLineItems,
      invoice.issueDate
    );

    await invoice.save({ session });

    await InvoiceEvent.create(
      [
        {
          invoiceId: invoice._id,
          schoolId,
          studentId: invoice.studentId,
          eventType: "adjustment_added",
          description: `${createdAdjustments.length} adjustment(s) added`,
          performedBy: userId || null,
          relatedAdjustmentId: createdAdjustments[0]?._id || null,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const updatedInvoice = await Invoice.findById(id)
      .populate("studentId", "firstName lastName admissionNo")
      .populate("academicPeriodId", "yearLabel term")
      .lean();

    return NextResponse.json({ invoice: updatedInvoice }, { status: 201 });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error adding adjustments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add adjustments" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
