// src/app/api/parent/payments/reconcile-pending/route.ts
/**
 * Background reconciliation for parent fee payments.
 *
 * Use case: a parent finished a Paystack checkout, but the platform
 * never received the `charge.success` webhook (common in local dev or
 * when the user closed the tab before the redirect). The PaymentIntent
 * is still `awaiting_webhook` and the Payment row never got written.
 *
 * This endpoint is called from `/parent/fees` on mount. It finds the
 * caller's recent pending intents, verifies them with Paystack, and
 * — if Paystack confirms success — posts the verification through the
 * internal Paystack webhook so all the existing fulfillment logic
 * (Payment creation, invoice update, ledger, emails, notifications)
 * runs unchanged.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { verifyTransaction } from "@/lib/paystack";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { Guardian } from "@/models/Guardian";
import { Payment } from "@/models/Payment";
import { PaymentIntent } from "@/models/PaymentIntent";

type PendingIntentRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amountMinor?: number;
  parentPayableMinor?: number;
  status?: string;
  paystackReference?: string | null;
};

type ReconciledPayment = {
  reference: string;
  paymentId: string;
  invoiceId: string;
  amountMinor: number;
  paymentDate: string | null;
  receiptViewUrl: string;
  receiptDownloadUrl: string;
};

const MAX_AGE_HOURS = 48;
const MAX_INTENTS_TO_CHECK = 10;

async function reconcileSingleIntent(
  intent: PendingIntentRow,
  secretKey: string
): Promise<ReconciledPayment | null> {
  const reference = (intent.paystackReference || "").trim();
  if (!reference) return null;

  let verification;
  try {
    verification = await verifyTransaction(reference);
  } catch (err) {
    console.warn("reconcile-pending: verify failed", {
      reference,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const verifiedStatus = String(verification.status || "").toLowerCase();
  if (verifiedStatus !== "success") {
    if (verifiedStatus === "failed" || verifiedStatus === "abandoned") {
      // Only pre-charge states may become failed; never one where money may have moved.
      await PaymentIntent.updateOne(
        { _id: intent._id, status: { $in: ["awaiting_webhook", "initiated"] } },
        {
          $set: {
            status: "failed",
            failureReason: "Paystack reports this payment did not complete.",
            expiresAt: null,
          },
        },
        { runValidators: true }
      ).catch(() => undefined);
    }
    return null;
  }

  // Amount/currency/reference/metadata are validated against the persisted
  // intent by the posting service, which records mismatches as
  // reconciliation_required. Only the fee routing fields are required here.
  const metadata = verification.metadata || {};
  if (!metadata.schoolId || !metadata.invoiceId || !metadata.studentId) {
    console.error("reconcile-pending: verified charge lacks fee metadata", {
      reference,
      paymentIntentId: String(intent._id),
    });
    return null;
  }

  const payload = JSON.stringify({
    event: "charge.success",
    data: verification,
  });
  const signature = crypto
    .createHmac("sha512", secretKey)
    .update(payload)
    .digest("hex");

  const webhookUrl = new URL("/api/webhooks/paystack", getAppUrl()).toString();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": signature,
      "x-edusentrix-internal-verification": "reconcile-pending",
    },
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("reconcile-pending: webhook post failed", {
      reference,
      status: response.status,
      body: body.slice(0, 400),
    });
    return null;
  }

  const posted = await Payment.findOne({
    schoolId: intent.schoolId,
    studentId: intent.studentId,
    paystackReference: reference,
    status: { $nin: ["failed", "reversed"] },
  })
    .select("_id invoiceId amountMinor paymentDate")
    .lean<{
      _id: mongoose.Types.ObjectId;
      invoiceId: mongoose.Types.ObjectId;
      amountMinor?: number;
      paymentDate?: Date;
    } | null>();

  if (!posted) return null;

  const paymentIdStr = String(posted._id);
  return {
    reference,
    paymentId: paymentIdStr,
    invoiceId: String(posted.invoiceId),
    amountMinor: Number(posted.amountMinor || 0),
    paymentDate: posted.paymentDate?.toISOString() || null,
    receiptViewUrl: `/api/parent/receipts/fee/${paymentIdStr}/download?disposition=inline`,
    receiptDownloadUrl: `/api/parent/receipts/fee/${paymentIdStr}/download`,
  };
}

export async function GET(_req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const secretKey = (process.env.PAYSTACK_SECRET_KEY || "").trim();
    if (!secretKey) {
      return NextResponse.json({
        success: true,
        data: { reconciled: [] as ReconciledPayment[] },
      });
    }

    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean<Array<{ studentId: mongoose.Types.ObjectId }>>();

    if (guardians.length === 0) {
      return NextResponse.json({
        success: true,
        data: { reconciled: [] as ReconciledPayment[] },
      });
    }

    const studentIds = guardians.map((g) => g.studentId);
    const since = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

    const pendingIntents = await PaymentIntent.find({
      schoolId: context.schoolId,
      studentId: { $in: studentIds },
      initiatedBy: context.userId,
      // `processing` covers legacy stuck intents; re-posting is idempotent and repairs them.
      status: { $in: ["awaiting_webhook", "initiated", "processing"] },
      paystackReference: { $ne: null },
      initiatedAt: { $gte: since },
    })
      .sort({ initiatedAt: -1 })
      .limit(MAX_INTENTS_TO_CHECK)
      .select(
        "_id schoolId studentId invoiceId amountMinor parentPayableMinor status paystackReference"
      )
      .lean<PendingIntentRow[]>();

    if (pendingIntents.length === 0) {
      return NextResponse.json({
        success: true,
        data: { reconciled: [] as ReconciledPayment[] },
      });
    }

    const reconciled: ReconciledPayment[] = [];
    for (const intent of pendingIntents) {
      try {
        const result = await reconcileSingleIntent(intent, secretKey);
        if (result) reconciled.push(result);
      } catch (err) {
        console.error("reconcile-pending: single intent failed", {
          intentId: String(intent._id),
          reference: intent.paystackReference,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { reconciled },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("reconcile-pending: failed", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reconcile pending payments",
      },
      { status: 500 }
    );
  }
}
