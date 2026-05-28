import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getPaystackKeyMode, initializeTransaction } from "@/lib/paystack";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { SubscriptionInvoice } from "@/models/SubscriptionInvoice";
import { SubscriptionCheckoutIntent } from "@/models/SubscriptionCheckoutIntent";
import { User } from "@/models/User";
import { School } from "@/models/School";

type Params = { params: Promise<{ id: string }> };

const PAYABLE_STATUSES = new Set(["issued", "overdue"]);

function normalizeAdminReturnPath(value: string | null) {
  if (!value) return "/admin/subscription";
  if (!value.startsWith("/") || value.startsWith("//")) return "/admin/subscription";
  try {
    const url = new URL(value, "http://localhost");
    if (url.pathname !== "/admin/subscription") return "/admin/subscription";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin/subscription";
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireSchoolAdmin();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid invoice ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  await connectToDatabase();

  const invoice = await SubscriptionInvoice.findOne({ _id: id, schoolId: auth.schoolId });
  if (!invoice) {
    return NextResponse.json({ success: false, error: "Subscription invoice not found." }, { status: 404 });
  }
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return NextResponse.json({ success: false, error: "This invoice is not payable online." }, { status: 409 });
  }
  if (invoice.totalMinor <= 0) {
    return NextResponse.json({ success: false, error: "This invoice has no amount due." }, { status: 409 });
  }

  const [user, school] = await Promise.all([
    User.findById(auth.userId).select("email").lean<{ email?: string | null } | null>(),
    School.findById(auth.schoolId).select("name").lean<{ name?: string | null } | null>(),
  ]);
  if (!user?.email) {
    return NextResponse.json({ success: false, error: "Your account needs an email address for checkout." }, { status: 400 });
  }

  const targetPlanId = invoice.lines.find((line) => line.reference && mongoose.Types.ObjectId.isValid(line.reference))?.reference ?? null;
  const targetPlan = targetPlanId ? await import("@/models/SubscriptionTier").then(({ SubscriptionTier }) => SubscriptionTier.findById(targetPlanId)) : null;
  if (!targetPlan) {
    return NextResponse.json(
      { success: false, error: "This invoice is missing a target subscription plan." },
      { status: 409 }
    );
  }

  const intent = await SubscriptionCheckoutIntent.create({
    schoolId: invoice.schoolId,
    subscriptionId: invoice.subscriptionId ?? null,
    invoiceId: invoice._id,
    targetTierId: targetPlan._id,
    targetTierCode: targetPlan.code,
    targetTierName: targetPlan.name,
    amountMinor: invoice.totalMinor,
    currency: invoice.currency,
    status: "initiated",
    idempotencyKey: randomUUID(),
    requestedBy: auth.userId,
    requestedByEmail: user.email,
  });

  const appUrl = getAppUrl().replace(/\/$/, "");
  const callbackUrl = new URL(normalizeAdminReturnPath(String(body.returnPath || "")), appUrl);
  callbackUrl.searchParams.set("checkout", "subscription");
  const reference = `EDSX-SUB-${String(intent._id)}-${Date.now()}`;

  try {
    const init = await initializeTransaction({
      email: user.email,
      amountMinor: invoice.totalMinor,
      reference,
      callbackUrl: callbackUrl.toString(),
      currency: invoice.currency,
      metadata: {
        type: "subscription_invoice",
        schoolId: String(invoice.schoolId),
        schoolName: school?.name ?? null,
        subscriptionId: invoice.subscriptionId ? String(invoice.subscriptionId) : null,
        subscriptionInvoiceId: String(invoice._id),
        subscriptionCheckoutIntentId: String(intent._id),
        targetTierId: String(targetPlan._id),
        targetTierCode: targetPlan.code,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await SubscriptionCheckoutIntent.findByIdAndUpdate(intent._id, {
      $set: {
        status: "awaiting_webhook",
        paystackReference: init.reference,
        expiresAt,
        failureReason: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: init.authorization_url,
        reference: init.reference,
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        amountMinor: invoice.totalMinor,
        expiresAt: expiresAt.toISOString(),
        paystackKeyMode: getPaystackKeyMode(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paystack checkout failed.";
    await SubscriptionCheckoutIntent.findByIdAndUpdate(intent._id, {
      $set: {
        status: "failed",
        failureReason: message,
      },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
