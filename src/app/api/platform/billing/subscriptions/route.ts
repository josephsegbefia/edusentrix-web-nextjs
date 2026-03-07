import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ensureDefaultSubscriptionTiers } from "@/lib/platform-billing/subscription-tiers";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { School } from "@/models/School";

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  status?: string;
};

type SchoolSubscriptionRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  tierId?: mongoose.Types.ObjectId | null;
  status?: string;
  basePriceMinor?: number;
  manualPriceOverrideMinor?: number | null;
  discountMode?: "none" | "percent" | "fixed";
  discountValue?: number | null;
  effectivePriceMinor?: number;
  note?: string | null;
  pilotEndsAt?: Date | null;
  updatedAt?: Date | null;
};

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const [tiers, schools, subscriptions] = await Promise.all([
      ensureDefaultSubscriptionTiers(),
      School.find({}).select("name status").sort({ name: 1 }).lean<SchoolRow[]>(),
      SchoolSubscription.find({})
        .select(
          "schoolId tierId status basePriceMinor manualPriceOverrideMinor discountMode discountValue effectivePriceMinor note pilotEndsAt updatedAt"
        )
        .lean<SchoolSubscriptionRow[]>(),
    ]);

    const subscriptionBySchoolId = new Map(
      subscriptions.map((subscription) => [
        String(subscription.schoolId),
        subscription,
      ])
    );

    return NextResponse.json({
      success: true,
      data: {
        tiers: tiers.map((tier) => ({
          id: String(tier._id),
          code: tier.code,
          name: tier.name,
          description: tier.description || null,
          priceMinor: tier.priceMinor,
          billingCadence: tier.billingCadence,
          studentLimit: tier.studentLimit ?? null,
          provisional: Boolean(tier.provisional),
          active: Boolean(tier.active),
        })),
        schools: schools.map((school) => {
          const subscription = subscriptionBySchoolId.get(String(school._id));
          return {
            id: String(school._id),
            name: school.name || "Unnamed School",
            status: school.status || "pending",
            subscription: subscription
              ? {
                  id: String(subscription._id),
                  tierId: subscription.tierId ? String(subscription.tierId) : null,
                  status: subscription.status || "draft",
                  basePriceMinor: subscription.basePriceMinor ?? 0,
                  manualPriceOverrideMinor:
                    subscription.manualPriceOverrideMinor ?? null,
                  discountMode: subscription.discountMode || "none",
                  discountValue: subscription.discountValue ?? null,
                  effectivePriceMinor: subscription.effectivePriceMinor ?? 0,
                  note: subscription.note || null,
                  pilotEndsAt:
                    subscription.pilotEndsAt?.toISOString?.().slice(0, 10) || null,
                  updatedAt: subscription.updatedAt?.toISOString?.() || null,
                }
              : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Failed to load platform subscriptions:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load platform subscriptions",
      },
      { status: 500 }
    );
  }
}
