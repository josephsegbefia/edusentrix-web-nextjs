// src/app/api/admin/fees/invoices/bulk/issue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { calculateInvoiceStatus } from "@/lib/fees/invoice-utils";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const body = await req.json();
    const { invoiceIds } = body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "invoiceIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const session = await mongoose.connection.startSession();
    const results = {
      succeeded: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    };

    try {
      await session.withTransaction(async () => {
        for (const invoiceId of invoiceIds) {
          try {
            const invoice = await Invoice.findOne({
              _id: invoiceId,
              schoolId,
            }).session(session);

            if (!invoice) {
              results.failed.push({
                id: invoiceId,
                error: "Invoice not found",
              });
              continue;
            }

            if (invoice.status !== "draft") {
              results.failed.push({
                id: invoiceId,
                error: `Invoice is ${invoice.status}, only draft invoices can be issued`,
              });
              continue;
            }

            // Issue the invoice
            invoice.status = "issued";
            invoice.issueDate = new Date();
            invoice.version += 1;

            await invoice.save({ session });

            // Create event
            await InvoiceEvent.create(
              [
                {
                  invoiceId: invoice._id,
                  eventType: "issued",
                  description: "Invoice issued",
                  performedBy: userId,
                },
              ],
              { session }
            );

            results.succeeded.push(invoiceId);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            results.failed.push({
              id: invoiceId,
              error: errorMessage,
            });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: invoiceIds.length,
        succeeded: results.succeeded.length,
        failed: results.failed.length,
      },
    });
  } catch (error) {
    console.error("Error bulk issuing invoices:", error);
    return NextResponse.json(
      { error: "Failed to bulk issue invoices" },
      { status: 500 }
    );
  }
}
