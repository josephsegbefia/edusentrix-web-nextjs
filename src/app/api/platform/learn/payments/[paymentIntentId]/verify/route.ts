import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { fulfillLearnPaymentSuccess, markLearnPaymentFailed } from "@/lib/learn/fulfill-learn-payment";
import { verifyTransaction } from "@/lib/paystack";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";

type Params = { params: Promise<{ paymentIntentId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const gate = await requirePlatformPermission("platform.learn.payments.read");
  if (!gate.ok) return gate.res;

  const { paymentIntentId } = await params;
  if (!Types.ObjectId.isValid(paymentIntentId)) {
    return NextResponse.json({ success: false, error: "Invalid payment id." }, { status: 400 });
  }

  await connectToDatabase();

  const payment = await LearnPaymentIntent.findById(paymentIntentId)
    .select("_id status paystackReference")
    .lean<{ _id: Types.ObjectId; status: string; paystackReference?: string | null } | null>();
  if (!payment) {
    return NextResponse.json({ success: false, error: "Learn payment not found." }, { status: 404 });
  }
  if (!payment.paystackReference) {
    return NextResponse.json({ success: false, error: "Payment has no Paystack reference." }, { status: 409 });
  }
  if (payment.status === "succeeded") {
    return NextResponse.json({ success: true, data: { status: "succeeded", alreadyVerified: true } });
  }

  const verification = await verifyTransaction(payment.paystackReference);
  const paystackStatus = String(verification.status || "").toLowerCase();

  if (paystackStatus === "success") {
    const outcome = await fulfillLearnPaymentSuccess({
      reference: payment.paystackReference,
      verification,
      actorType: "verify",
    });
    return NextResponse.json({ success: outcome.ok, data: outcome, error: outcome.ok ? undefined : outcome.message });
  }

  if (paystackStatus === "failed" || paystackStatus === "abandoned") {
    await markLearnPaymentFailed({
      paymentIntentId: payment._id,
      reference: payment.paystackReference,
      failureReason:
        paystackStatus === "abandoned"
          ? "Checkout was abandoned before payment completed."
          : "Paystack reported that this Learn payment did not complete.",
      verification,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      status: paystackStatus || "pending",
      message: "Paystack has not confirmed this Learn payment as successful.",
    },
  });
}
