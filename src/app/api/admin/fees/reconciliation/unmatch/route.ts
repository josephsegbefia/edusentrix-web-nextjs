import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { Payment } from "@/models/Payment";

const BodySchema = z.object({
  ingestionId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

function toObjectId(value: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return new mongoose.Types.ObjectId(value);
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid reconciliation unmatch payload." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId && mongoose.Types.ObjectId.isValid(String(userId))
        ? new mongoose.Types.ObjectId(String(userId))
        : null;
    const ingestionId = toObjectId(parsed.data.ingestionId, "ingestionId");

    const ingestion = await ReconciliationIngestion.findOne({
      _id: ingestionId,
      schoolId: schoolIdObj,
    });
    if (!ingestion) {
      return NextResponse.json(
        { success: false, error: "Reconciliation ingestion item not found." },
        { status: 404 }
      );
    }

    const previousPaymentId = ingestion.matchedPaymentId || null;
    ingestion.status = "unmatched";
    ingestion.matchMethod = "none";
    ingestion.matchedPaymentId = null;
    ingestion.candidatePaymentIds = [];
    ingestion.confidence = 0;
    ingestion.notes =
      parsed.data.note ||
      "Manual unmatch requested. Payment reconciliation status was not auto-reverted.";
    await ingestion.save();

    if (previousPaymentId) {
      const payment = await Payment.findOne({
        _id: previousPaymentId,
        schoolId: schoolIdObj,
      }).select("_id invoiceId studentId reconciliationStatus");

      if (payment) {
        await PaymentAuditEvent.create({
          schoolId: schoolIdObj,
          paymentId: payment._id,
          invoiceId: payment.invoiceId || null,
          studentId: payment.studentId || null,
          eventType: "reconciliation_updated",
          title: "Manual reconciliation unmatch",
          description:
            parsed.data.note ||
            "Reconciliation evidence was detached manually. Payment status was kept unchanged.",
          actorId: userIdObj,
          metadata: {
            ingestionId: ingestion._id,
            previousStatus: payment.reconciliationStatus,
            paymentStatusChanged: false,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ingestionId: String(ingestion._id),
        previousPaymentId: previousPaymentId ? String(previousPaymentId) : null,
        status: ingestion.status,
      },
    });
  } catch (error: any) {
    const message =
      error instanceof Error ? error.message : "Failed to unmatch reconciliation item.";
    const status = message.startsWith("Invalid ") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
