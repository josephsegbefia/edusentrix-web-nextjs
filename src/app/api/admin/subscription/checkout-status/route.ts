import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { verifyTransaction } from "@/lib/paystack";
import { SubscriptionCheckoutIntent } from "@/models/SubscriptionCheckoutIntent";
import { fulfillSubscriptionCheckoutSuccess } from "@/lib/subscriptions/subscription-checkout";

export async function GET(req: NextRequest) {
  const auth = await requireSchoolAdmin();
  const reference = req.nextUrl.searchParams.get("reference")?.trim();
  if (!reference) {
    return NextResponse.json({ success: false, error: "Missing payment reference." }, { status: 400 });
  }

  await connectToDatabase();

  const intent = await SubscriptionCheckoutIntent.findOne({
    schoolId: auth.schoolId,
    paystackReference: reference,
  }).lean();
  if (!intent) {
    return NextResponse.json({ success: false, error: "Checkout not found." }, { status: 404 });
  }
  if (intent.status === "succeeded") {
    return NextResponse.json({ success: true, data: { status: "succeeded" } });
  }

  const verification = await verifyTransaction(reference);
  const status = String(verification.status || "").toLowerCase();
  if (status === "success") {
    const outcome = await fulfillSubscriptionCheckoutSuccess({
      reference,
      verification,
      actorType: "verify",
    });
    return NextResponse.json({
      success: outcome.ok,
      data: { status: outcome.ok ? "succeeded" : "failed", message: outcome.message },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      status: status || intent.status,
      message: status ? `Paystack status: ${status}` : "Payment is still pending.",
    },
  });
}
