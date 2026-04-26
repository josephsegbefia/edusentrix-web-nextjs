// src/app/api/public/admissions/applications/[token]/pay/verify/route.ts
// PUBLIC endpoint. Polls Paystack for the latest status of the application's
// pending fee transaction. The webhook is the source of truth; this exists so
// that the redirect-back UX can confirm payment immediately without waiting
// for the webhook to arrive.
//
// Always idempotent — calls `markFeePaidByReference` which is safe to retry.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { verifyTransaction } from "@/lib/paystack";
import {
  markFeeFailedByReference,
  markFeePaidByReference,
} from "@/lib/admissions/fee-payments";

type Params = Promise<{ token: string }>;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracker link" },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const application = await AdmissionApplication.findOne({
      "tracker.token": token,
    })
      .select({ feePayment: 1, feeStatus: 1, _id: 1 })
      .lean();
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    if (application.feeStatus === "paid") {
      return NextResponse.json({
        success: true,
        data: { feeStatus: "paid", source: "cache" },
      });
    }

    const reference = application.feePayment?.reference;
    if (!reference) {
      return NextResponse.json(
        {
          success: false,
          error: "No payment was started yet — try again from the tracker.",
        },
        { status: 400 }
      );
    }

    const verification = await verifyTransaction(reference);
    if (verification.status === "success") {
      const outcome = await markFeePaidByReference({
        reference,
        amountMinor: Number(verification.amount ?? application.feePayment?.amountMinor ?? 0),
        currency: verification.currency,
        paidAt: verification.paid_at ? new Date(verification.paid_at) : new Date(),
        channel: verification.channel ?? null,
        paystackMeta: {
          paystackId: verification.id ?? null,
          status: verification.status,
          channel: verification.channel ?? null,
          paidAt: verification.paid_at ?? null,
        },
      });
      return NextResponse.json({
        success: true,
        data: { feeStatus: "paid", source: "verify", outcome },
      });
    }

    if (
      verification.status === "failed" ||
      verification.status === "abandoned"
    ) {
      await markFeeFailedByReference({
        reference,
        amountMinor: Number(verification.amount ?? 0),
        currency: verification.currency,
        failureReason: verification.status,
      });
      return NextResponse.json({
        success: true,
        data: { feeStatus: "pending", paystackStatus: verification.status },
      });
    }

    // Still pending (e.g. mobile money 2FA in progress).
    return NextResponse.json({
      success: true,
      data: { feeStatus: "pending", paystackStatus: verification.status ?? "unknown" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Public admissions fee verify error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
