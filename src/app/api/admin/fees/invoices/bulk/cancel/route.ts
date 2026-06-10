// src/app/api/admin/fees/invoices/bulk/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { Payment } from "@/models/Payment";
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
                error: "Bill not found",
              });
              continue;
            }

            if (invoice.status === "cancelled") {
              results.failed.push({
                id: invoiceId,
                error: "Bill already withdrawn",
              });
              continue;
            }

            const paymentCount = await Payment.countDocuments({
              invoiceId: invoice._id,
              status: { $ne: "failed" },
            }).session(session);

            if (invoice.status === "paid" || paymentCount > 0) {
              results.failed.push({
                id: invoiceId,
                error:
                  "Bills with recorded payments cannot be withdrawn. Use an adjustment or credit note instead.",
              });
              continue;
            }

            // Withdraw the bill
            invoice.status = "cancelled";
            invoice.version += 1;

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
    console.error("Error bulk withdrawing bills:", error);
    return NextResponse.json(
      { error: "Failed to bulk withdraw bills" },
      { status: 500 }
    );
  }
}
