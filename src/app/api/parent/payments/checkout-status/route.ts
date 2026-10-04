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

type GuardLink = {
  studentId: mongoose.Types.ObjectId;
};

type PaymentRow = {
  _id: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amountMinor?: number;
  paymentDate?: Date;
  status?: string;
};

type PaymentIntentRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amountMinor?: number;
  parentPayableMinor?: number;
  status?: string;
  failureReason?: string | null;
};

async function findCompletedPayment(args: {
  schoolId: mongoose.Types.ObjectId;
  studentIds: mongoose.Types.ObjectId[];
  reference: string;
}) {
  return Payment.findOne({
    schoolId: args.schoolId,
    studentId: { $in: args.studentIds },
    paystackReference: args.reference,
    status: { $nin: ["failed", "reversed"] },
  })
    .select("_id invoiceId amountMinor paymentDate status")
    .lean<PaymentRow | null>();
}

async function postVerifiedPaystackPaymentToLedger(args: {
  reference: string;
  paymentIntent: PaymentIntentRow;
}) {
  const verification = await verifyTransaction(args.reference);
  const metadata = verification.metadata || {};
  const verifiedStatus = String(verification.status || "").toLowerCase();
  if (verifiedStatus !== "success") {
    return {
      posted: false,
      terminalStatus:
        verifiedStatus === "failed" || verifiedStatus === "abandoned"
          ? "failed"
          : "pending",
      message:
        verifiedStatus === "failed" || verifiedStatus === "abandoned"
          ? "This payment was not completed by Paystack."
          : "Your payment is still being verified by Paystack.",
    };
  }

  // Amount/currency/reference/metadata are validated against the persisted
  // intent by the posting service, which records mismatches as
  // reconciliation_required. Only the fee routing fields are required here.
  if (!metadata.schoolId || !metadata.invoiceId || !metadata.studentId) {
    console.error("Paystack fallback: verified charge lacks fee metadata", {
      reference: args.reference,
      paymentIntentId: String(args.paymentIntent._id),
    });
    return {
      posted: false,
      terminalStatus: "pending",
      message:
        "Paystack reports this payment as successful, but its details need review before we can update the school ledger.",
    };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return {
      posted: false,
      terminalStatus: "pending",
      message:
        "Paystack reports this payment as successful, but payment posting is not configured on the server.",
    };
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
      "x-edusentrix-internal-verification": "checkout-status",
    },
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Paystack fallback posting failed:", {
      reference: args.reference,
      status: response.status,
      body: body.slice(0, 500),
    });
    return {
      posted: false,
      terminalStatus: "pending",
      message:
        "Paystack reports this payment as successful. We are still posting it to the school ledger.",
    };
  }

  return {
    posted: true,
    terminalStatus: "pending",
    message:
      "Paystack reports this payment as successful. We are confirming the school ledger update.",
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const reference = req.nextUrl.searchParams.get("reference")?.trim();
    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Missing reference" },
        { status: 400 }
      );
    }

    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean<GuardLink[]>();
    const studentIds = guardians.map((g) => g.studentId);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          status: "not_found",
          message: "No wards linked to this account.",
        },
      });
    }

    const payment = await findCompletedPayment({
      schoolId: context.schoolId,
      studentIds,
      reference,
    });

    if (payment) {
      return NextResponse.json({
        success: true,
        data: {
          status: "completed",
          paymentId: String(payment._id),
          invoiceId: String(payment.invoiceId),
          amountMinor: Number(payment.amountMinor || 0),
          paymentDate: payment.paymentDate?.toISOString() || null,
          receiptViewUrl: `/api/parent/receipts/fee/${String(payment._id)}/download?disposition=inline`,
          receiptDownloadUrl: `/api/parent/receipts/fee/${String(payment._id)}/download`,
          message: "Payment confirmed.",
        },
      });
    }

    const paymentIntent = await PaymentIntent.findOne({
      schoolId: context.schoolId,
      studentId: { $in: studentIds },
      paystackReference: reference,
    })
      .select("_id schoolId studentId invoiceId amountMinor parentPayableMinor status failureReason")
      .lean<PaymentIntentRow | null>();

    if (!paymentIntent) {
      return NextResponse.json({
        success: true,
        data: {
          status: "not_found",
          message: "We have not received confirmation for this payment yet.",
        },
      });
    }

    let intentStatus = paymentIntent.status;
    let failureReason = paymentIntent.failureReason || null;
    let fallbackMessage: string | null = null;
    if (paymentIntent.status === "reconciliation_required") {
      fallbackMessage =
        "Paystack confirmed this payment. The school is reconciling it and your balance will update once it is posted.";
    }
    if (
      paymentIntent.status === "awaiting_webhook" ||
      paymentIntent.status === "initiated" ||
      // Legacy stuck intents: re-posting is idempotent and repairs them.
      paymentIntent.status === "processing"
    ) {
      try {
        const fallback = await postVerifiedPaystackPaymentToLedger({
          reference,
          paymentIntent,
        });

        const postedPayment = await findCompletedPayment({
          schoolId: context.schoolId,
          studentIds,
          reference,
        });

        if (postedPayment) {
          return NextResponse.json({
            success: true,
            data: {
              status: "completed",
              paymentId: String(postedPayment._id),
              invoiceId: String(postedPayment.invoiceId),
              amountMinor: Number(postedPayment.amountMinor || 0),
              paymentDate: postedPayment.paymentDate?.toISOString() || null,
              receiptViewUrl: `/api/parent/receipts/fee/${String(postedPayment._id)}/download?disposition=inline`,
              receiptDownloadUrl: `/api/parent/receipts/fee/${String(postedPayment._id)}/download`,
              message: "Payment confirmed.",
            },
          });
        }

        if (fallback.terminalStatus === "failed") {
          // Only pre-charge states may become failed; never one where money may have moved.
          const failed = await PaymentIntent.findOneAndUpdate(
            {
              _id: paymentIntent._id,
              status: { $in: ["awaiting_webhook", "initiated"] },
            },
            {
              $set: {
                status: "failed",
                failureReason: fallback.message,
                expiresAt: null,
              },
            },
            { new: true, runValidators: true }
          )
            .select("_id")
            .lean()
            .catch(() => null);
          if (failed) {
            intentStatus = "failed";
            failureReason = fallback.message;
          }
        }
        fallbackMessage = fallback.message;

        if (fallback.posted) {
          const refreshed = await PaymentIntent.findById(paymentIntent._id)
            .select("status")
            .lean<{ status?: string } | null>();
          if (refreshed?.status === "reconciliation_required") {
            intentStatus = "reconciliation_required";
            fallbackMessage =
              "Paystack confirmed this payment. The school is reconciling it and your balance will update once it is posted.";
          }
        }
      } catch (verificationError) {
        console.error("Paystack fallback verification failed:", {
          reference,
          error: verificationError,
        });
        fallbackMessage =
          "We could not verify this payment with Paystack yet. Please check again shortly.";
      }
    }

    const mappedStatus =
      intentStatus === "succeeded"
        ? "completed"
        : intentStatus === "failed" ||
            intentStatus === "cancelled" ||
            intentStatus === "expired"
          ? "failed"
          : "pending";

    return NextResponse.json({
      success: true,
      data: {
        status: mappedStatus,
        paymentIntentId: String(paymentIntent._id),
        invoiceId: String(paymentIntent.invoiceId),
        amountMinor: Number(paymentIntent.amountMinor || 0),
        message:
          mappedStatus === "failed"
            ? failureReason || "This checkout did not complete."
            : mappedStatus === "completed"
              ? "Payment confirmed."
              : fallbackMessage || "Your payment is being verified.",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent checkout status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch checkout status",
      },
      { status: 500 }
    );
  }
}
