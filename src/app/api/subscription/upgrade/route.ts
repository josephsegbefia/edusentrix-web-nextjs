import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { initializeTransaction } from "@/lib/paystack";
import { applySuccessfulSubscriptionCheckoutIntent } from "@/lib/billing/subscription-checkout";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { SubscriptionCheckoutIntent } from "@/models/SubscriptionCheckoutIntent";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { User } from "@/models/User";

const UpgradeSchema = z.object({
  tierId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  let checkoutIntentId: mongoose.Types.ObjectId | null = null;
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    const body = UpgradeSchema.parse(await req.json());

    if (!mongoose.Types.ObjectId.isValid(body.tierId)) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier." },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const tierId = new mongoose.Types.ObjectId(body.tierId);
    const [tier, existingSubscription, actor] = await Promise.all([
      SubscriptionTier.findById(tierId).select("code name priceMinor active"),
      SchoolSubscription.findOne({ schoolId: schoolIdObj }).select(
        "_id tierId tierCode"
      ),
      User.findById(userId).select("email").lean<{ email?: string } | null>(),
    ]);

    if (!tier || !tier.active) {
      return NextResponse.json(
        { success: false, error: "Subscription tier not found." },
        { status: 404 }
      );
    }

    if (!actor?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Your admin account needs a valid email address for checkout.",
        },
        { status: 400 }
      );
    }

    if (
      existingSubscription?.tierId &&
      String(existingSubscription.tierId) === String(tier._id)
    ) {
      return NextResponse.json(
        {
          success: true,
          data: {
            paymentRequired: false,
            alreadyCurrent: true,
            tierName: tier.name,
          },
        },
        { status: 200 }
      );
    }

    const amountMinor = Math.max(0, Math.round(Number(tier.priceMinor || 0)));
    const checkoutIntent = await SubscriptionCheckoutIntent.create({
      schoolId: schoolIdObj,
      subscriptionId: existingSubscription?._id || null,
      targetTierId: tier._id,
      targetTierCode: tier.code,
      targetTierName: tier.name,
      amountMinor,
      currency: "GHS",
      status: "initiated",
      idempotencyKey: `sub-upgrade:${schoolIdObj}:${tier._id}:${randomUUID()}`,
      requestedBy: userId,
      requestedByEmail: actor?.email || null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    checkoutIntentId = checkoutIntent._id;

    if (amountMinor <= 0) {
      const applied = await applySuccessfulSubscriptionCheckoutIntent({
        checkoutIntentId: checkoutIntent._id,
      });

      if (!applied) {
        return NextResponse.json(
          { success: false, error: "Failed to apply subscription change." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          paymentRequired: false,
          tierName: applied.subscription.tierName || tier.name,
          effectivePriceMinor: applied.subscription.effectivePriceMinor,
        },
      });
    }

    const reference = `sub_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const callbackUrl = `${getAppUrl()}/admin/billing?subscriptionRef=${encodeURIComponent(reference)}`;
    const tx = await initializeTransaction({
      email: actor.email,
      amountMinor,
      reference,
      callbackUrl,
      metadata: {
        type: "subscription_upgrade",
        schoolId: String(schoolIdObj),
        tierId: String(tier._id),
        subscriptionCheckoutIntentId: String(checkoutIntent._id),
      },
    });

    checkoutIntent.status = "awaiting_webhook";
    checkoutIntent.paystackReference = tx.reference;
    await checkoutIntent.save();

    return NextResponse.json({
      success: true,
      data: {
        paymentRequired: true,
        tierName: tier.name,
        amountMinor,
        checkoutUrl: tx.authorization_url,
        reference: tx.reference,
      },
    });
  } catch (error) {
    if (checkoutIntentId) {
      await SubscriptionCheckoutIntent.findByIdAndUpdate(checkoutIntentId, {
        $set: {
          status: "failed",
          failureReason:
            error instanceof Error
              ? error.message
              : "Failed to start subscription upgrade",
        },
      }).catch(() => undefined);
    }
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid upgrade payload." },
        { status: 400 }
      );
    }
    console.error("Failed to start subscription upgrade:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start subscription upgrade",
      },
      { status: 500 }
    );
  }
}
