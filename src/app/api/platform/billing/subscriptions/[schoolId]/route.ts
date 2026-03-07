import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { School } from "@/models/School";
import { User } from "@/models/User";

const UpdateSchoolSubscriptionSchema = z
  .object({
    tierId: z.string().trim().min(1),
    status: z.enum(["draft", "trial", "active", "suspended", "cancelled"]),
    manualPriceOverrideMinor: z.number().int().min(0).nullable().optional().default(null),
    discountMode: z.enum(["none", "percent", "fixed"]),
    discountValue: z.number().min(0).nullable().optional().default(null),
    note: z.string().trim().max(240).nullable().optional().default(null),
    pilotEndsAt: z.string().trim().nullable().optional().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.discountMode !== "none" && value.discountValue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Discount value is required when a discount is selected.",
      });
    }

    if (
      value.discountMode === "percent" &&
      value.discountValue !== null &&
      value.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discount cannot be greater than 100.",
      });
    }
  });

function parsePilotEndsAt(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveEventType(input: {
  existingStatus?: string | null;
  nextStatus: string;
  hasExisting: boolean;
}) {
  if (!input.hasExisting) return "subscription_assigned" as const;
  if (input.nextStatus === "cancelled") return "subscription_cancelled" as const;
  if (
    input.existingStatus === "suspended" &&
    (input.nextStatus === "active" || input.nextStatus === "trial")
  ) {
    return "subscription_reactivated" as const;
  }
  if (input.nextStatus === "suspended") return "subscription_suspended" as const;
  return "subscription_updated" as const;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ schoolId: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { schoolId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const body = UpdateSchoolSubscriptionSchema.parse(await req.json());
    if (!mongoose.Types.ObjectId.isValid(body.tierId)) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier." },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
    const [school, tier, existing, actor] = await Promise.all([
      School.findById(schoolIdObj).select("name"),
      SubscriptionTier.findById(new mongoose.Types.ObjectId(body.tierId)).select(
        "code name priceMinor"
      ),
      SchoolSubscription.findOne({ schoolId: schoolIdObj })
        .select("status")
        .lean<{ _id: mongoose.Types.ObjectId; status?: string } | null>(),
      User.findById(gate.me._id).select("email").lean<{ email?: string } | null>(),
    ]);

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    if (!tier) {
      return NextResponse.json(
        { success: false, error: "Subscription tier not found." },
        { status: 404 }
      );
    }

    const pilotEndsAt = parsePilotEndsAt(body.pilotEndsAt);
    if (body.pilotEndsAt && !pilotEndsAt) {
      return NextResponse.json(
        { success: false, error: "Invalid pilot end date." },
        { status: 400 }
      );
    }

    const pricing = computeSubscriptionPricing({
      basePriceMinor: tier.priceMinor,
      manualPriceOverrideMinor: body.manualPriceOverrideMinor,
      discountMode: body.discountMode,
      discountValue: body.discountValue,
    });

    const updated = await SchoolSubscription.findOneAndUpdate(
      { schoolId: schoolIdObj },
      {
        $set: {
          tierId: tier._id,
          tierCode: tier.code,
          tierName: tier.name,
          status: body.status,
          basePriceMinor: tier.priceMinor,
          manualPriceOverrideMinor: body.manualPriceOverrideMinor,
          discountMode: body.discountMode,
          discountValue: body.discountMode === "none" ? null : body.discountValue,
          effectivePriceMinor: pricing.finalPriceMinor,
          note: body.note,
          pilotEndsAt,
          updatedBy: gate.me._id,
          updatedByEmail: actor?.email || null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    const eventType = resolveEventType({
      existingStatus: existing?.status || null,
      nextStatus: body.status,
      hasExisting: Boolean(existing),
    });

    await SubscriptionEvent.create({
      schoolId: schoolIdObj,
      subscriptionId: updated._id,
      eventType,
      actorId: gate.me._id,
      actorEmail: actor?.email || null,
      summary: `${school.name || "School"} moved to ${tier.name} (${body.status}).`,
      metadata: {
        tierId: String(tier._id),
        tierCode: tier.code,
        manualPriceOverrideMinor: body.manualPriceOverrideMinor,
        discountMode: body.discountMode,
        discountValue: body.discountMode === "none" ? null : body.discountValue,
        effectivePriceMinor: pricing.finalPriceMinor,
        pilotEndsAt: pilotEndsAt?.toISOString?.() || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        schoolId,
        tierId: String(tier._id),
        tierName: tier.name,
        status: updated.status,
        basePriceMinor: updated.basePriceMinor,
        manualPriceOverrideMinor: updated.manualPriceOverrideMinor ?? null,
        discountMode: updated.discountMode,
        discountValue: updated.discountValue ?? null,
        effectivePriceMinor: updated.effectivePriceMinor,
        note: updated.note || null,
        pilotEndsAt: updated.pilotEndsAt?.toISOString?.().slice(0, 10) || null,
        updatedAt: updated.updatedAt?.toISOString?.() || null,
        pricing,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription update payload." },
        { status: 400 }
      );
    }

    console.error("Failed to update school subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update school subscription",
      },
      { status: 500 }
    );
  }
}
