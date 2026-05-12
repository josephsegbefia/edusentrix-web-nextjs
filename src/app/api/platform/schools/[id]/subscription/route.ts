import { NextRequest, NextResponse } from "next/server";
import mongoose, { type HydratedDocument } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildPlatformAdminAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { ensureDefaultSubscriptionTiers } from "@/lib/platform-billing/subscription-tiers";
import {
  BILLING_CADENCES,
  SUBSCRIPTION_LIFECYCLE_MODES,
  SUBSCRIPTION_STATUSES,
  computeSubscriptionPricing,
} from "@/lib/platform-billing/subscription-pricing";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { SchoolSubscription, type ISchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { School } from "@/models/School";
import { User } from "@/models/User";

const SPEC_TIER_CODES = new Set(["starter", "growth", "premium", "enterprise"]);

const UpdateSchoolSubscriptionSchema = z
  .object({
    tierId: z.string().trim().min(1),
    status: z.enum(SUBSCRIPTION_STATUSES),
    lifecycleMode: z.enum(SUBSCRIPTION_LIFECYCLE_MODES).nullable().optional().default(null),
    billingCadence: z.enum(BILLING_CADENCES).nullable().optional().default(null),
    startsAt: z.string().trim().nullable().optional().default(null),
    endsAt: z.string().trim().nullable().optional().default(null),
    trialStartsAt: z.string().trim().nullable().optional().default(null),
    trialEndsAt: z.string().trim().nullable().optional().default(null),
    pilotStartsAt: z.string().trim().nullable().optional().default(null),
    manualPriceOverrideMinor: z.number().int().min(0).nullable().optional().default(null),
    discountMode: z.enum(["none", "percent", "fixed"]),
    discountValue: z.number().min(0).nullable().optional().default(null),
    note: z.string().trim().max(240).nullable().optional().default(null),
    pilotEndsAt: z.string().trim().nullable().optional().default(null),
    gracePeriodEndsAt: z.string().trim().nullable().optional().default(null),
    usageResetPolicy: z.enum(["term", "annual", "custom"]).nullable().optional().default(null),
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

function parseDateField(value: string | null): Date | null {
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
    (input.nextStatus === "active" ||
      input.nextStatus === "trial" ||
      input.nextStatus === "trialing" ||
      input.nextStatus === "pilot")
  ) {
    return "subscription_reactivated" as const;
  }
  if (input.nextStatus === "suspended") return "subscription_suspended" as const;
  return "subscription_updated" as const;
}

function subscriptionActionCode(eventType: ReturnType<typeof resolveEventType>): string {
  switch (eventType) {
    case "subscription_assigned":
      return "subscription.assigned";
    case "subscription_cancelled":
      return "subscription.cancelled";
    case "subscription_reactivated":
      return "subscription.reactivated";
    case "subscription_suspended":
      return "subscription.suspended";
    default:
      return "subscription.updated";
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const schoolId = new mongoose.Types.ObjectId(id);
    const [tiers, school, subscription] = await Promise.all([
      ensureDefaultSubscriptionTiers(),
      School.findById(schoolId).select("name status").lean(),
      SchoolSubscription.findOne({ schoolId })
        .select(
          "tierId tierCode tierName tierVersion status lifecycleMode billingCadence startsAt endsAt trialEndsAt pilotEndsAt gracePeriodEndsAt basePriceMinor manualPriceOverrideMinor discountMode discountValue effectivePriceMinor note usageResetPolicy updatedAt"
        )
        .lean(),
    ]);

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        school: {
          id,
          name: school.name || "Unnamed School",
          status: school.status || "pending",
        },
        tiers: tiers
          .filter((tier) => SPEC_TIER_CODES.has(tier.code))
          .map((tier) => ({
            id: String(tier._id),
            code: tier.code,
            name: tier.name,
            description: tier.description || null,
            priceMinor: tier.priceMinor,
            active: Boolean(tier.active),
            provisional: Boolean(tier.provisional),
            billingCadence: tier.billingCadence,
            version: tier.version ?? 1,
          })),
        subscription: subscription
          ? {
              id: String(subscription._id),
              tierId: subscription.tierId ? String(subscription.tierId) : null,
              tierCode: subscription.tierCode || null,
              tierName: subscription.tierName || null,
              tierVersion: subscription.tierVersion ?? null,
              status: subscription.status || "draft",
              lifecycleMode: subscription.lifecycleMode || null,
              billingCadence: subscription.billingCadence || null,
              startsAt:
                subscription.startsAt?.toISOString?.().slice(0, 10) || null,
              endsAt: subscription.endsAt?.toISOString?.().slice(0, 10) || null,
              trialEndsAt:
                subscription.trialEndsAt?.toISOString?.().slice(0, 10) || null,
              basePriceMinor: subscription.basePriceMinor ?? 0,
              manualPriceOverrideMinor:
                subscription.manualPriceOverrideMinor ?? null,
              discountMode: subscription.discountMode || "none",
              discountValue: subscription.discountValue ?? null,
              effectivePriceMinor: subscription.effectivePriceMinor ?? 0,
              note: subscription.note || null,
              pilotEndsAt:
                subscription.pilotEndsAt?.toISOString?.().slice(0, 10) || null,
              gracePeriodEndsAt:
                subscription.gracePeriodEndsAt?.toISOString?.().slice(0, 10) ||
                null,
              usageResetPolicy: subscription.usageResetPolicy || null,
              updatedAt: subscription.updatedAt?.toISOString?.() || null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to load school subscription detail:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load school subscription detail",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(id);
    const [school, tier, snapshotBefore, actor] = await Promise.all([
      School.findById(schoolIdObj).select("name"),
      SubscriptionTier.findById(new mongoose.Types.ObjectId(body.tierId)).select(
        "code name priceMinor billingCadence features limits transactionFees version"
      ),
      SchoolSubscription.findOne({ schoolId: schoolIdObj })
        .select("status tierCode tierName effectivePriceMinor")
        .lean<{
          _id: mongoose.Types.ObjectId;
          status?: string;
          tierCode?: string | null;
          tierName?: string | null;
          effectivePriceMinor?: number | null;
        } | null>(),
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

    const parsedDates = {
      startsAt: parseDateField(body.startsAt),
      endsAt: parseDateField(body.endsAt),
      trialStartsAt: parseDateField(body.trialStartsAt),
      trialEndsAt: parseDateField(body.trialEndsAt),
      pilotStartsAt: parseDateField(body.pilotStartsAt),
      pilotEndsAt: parseDateField(body.pilotEndsAt),
      gracePeriodEndsAt: parseDateField(body.gracePeriodEndsAt),
    };

    for (const [field, parsed] of Object.entries(parsedDates)) {
      if (body[field as keyof typeof parsedDates] && !parsed) {
        return NextResponse.json(
          { success: false, error: `Invalid ${field} date.` },
          { status: 400 }
        );
      }
    }

    const pricing = computeSubscriptionPricing({
      basePriceMinor: tier.priceMinor,
      manualPriceOverrideMinor: body.manualPriceOverrideMinor,
      discountMode: body.discountMode,
      discountValue: body.discountValue,
    });

    const platformAdminId = new mongoose.Types.ObjectId(String(gate.me._id));

    const session = await mongoose.startSession();
    let updated!: HydratedDocument<ISchoolSubscription>;
    let eventType!: ReturnType<typeof resolveEventType>;

    try {
      await session.withTransaction(async () => {
        const sub = await SchoolSubscription.findOneAndUpdate(
          { schoolId: schoolIdObj },
          {
            $set: {
              tierId: tier._id,
              tierCode: tier.code,
              tierName: tier.name,
              tierVersion: tier.version ?? 1,
              status: body.status,
              lifecycleMode: body.lifecycleMode,
              billingCadence: body.billingCadence || tier.billingCadence || "term",
              startsAt: parsedDates.startsAt,
              endsAt: parsedDates.endsAt,
              trialStartsAt: parsedDates.trialStartsAt,
              trialEndsAt: parsedDates.trialEndsAt,
              pilotStartsAt: parsedDates.pilotStartsAt,
              pilotEndsAt: parsedDates.pilotEndsAt,
              gracePeriodEndsAt: parsedDates.gracePeriodEndsAt,
              basePriceMinor: tier.priceMinor,
              manualPriceOverrideMinor: body.manualPriceOverrideMinor,
              discountMode: body.discountMode,
              discountValue: body.discountMode === "none" ? null : body.discountValue,
              effectivePriceMinor: pricing.finalPriceMinor,
              note: body.note,
              featuresSnapshot: Array.isArray(tier.features) ? tier.features : [],
              includedLimitsSnapshot: tier.limits || null,
              transactionFeeSnapshot: tier.transactionFees || null,
              usageResetPolicy: body.usageResetPolicy,
              updatedBy: gate.me._id,
              updatedByEmail: actor?.email || null,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            session,
          }
        );

        if (!sub) throw new Error("SUBSCRIPTION_UPDATE_FAILED");

        updated = sub as HydratedDocument<ISchoolSubscription>;
        eventType = resolveEventType({
          existingStatus: snapshotBefore?.status || null,
          nextStatus: body.status,
          hasExisting: Boolean(snapshotBefore),
        });

        await SubscriptionEvent.create(
          [
            {
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
                lifecycleMode: body.lifecycleMode,
                billingCadence: body.billingCadence || tier.billingCadence || "term",
                startsAt: parsedDates.startsAt?.toISOString?.() || null,
                endsAt: parsedDates.endsAt?.toISOString?.() || null,
                trialEndsAt: parsedDates.trialEndsAt?.toISOString?.() || null,
                pilotEndsAt: parsedDates.pilotEndsAt?.toISOString?.() || null,
                gracePeriodEndsAt:
                  parsedDates.gracePeriodEndsAt?.toISOString?.() || null,
              },
            },
          ],
          { session }
        );

        const actionCode = subscriptionActionCode(eventType);
        const baseCtx = buildPlatformAdminAuditContext(req, {
          platformAdminId,
          actorEmail: actor?.email ?? null,
          actorName: null,
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `subscription.patch:${id}:${String(updated._id)}`
          ),
        });

        const reasonBlock =
          actionCode === "subscription.cancelled"
            ? {
                reason: body.note?.trim() || "Subscription cancelled",
              }
            : undefined;

        await writeTransactionalAuditEvent(session, {
          actionCode,
          scopeType: "school",
          scopeId: String(schoolIdObj),
          result: "succeeded",
          target: {
            targetEntityType: "SchoolSubscription",
            targetEntityId: updated._id,
            secondaryEntityType: "School",
            secondaryEntityId: schoolIdObj,
          },
          context: baseCtx,
          reason: reasonBlock,
          payload: {
            before: {
              status: snapshotBefore?.status ?? null,
              tierCode: snapshotBefore?.tierCode ?? null,
              effectivePriceMinor: snapshotBefore?.effectivePriceMinor ?? null,
            },
            after: {
              status: updated.status,
              tierCode: tier.code,
              effectivePriceMinor: pricing.finalPriceMinor,
              billingCadence: updated.billingCadence || null,
              lifecycleMode: updated.lifecycleMode || null,
            },
            metadata: {
              eventType,
              tierName: tier.name,
            },
          },
          streamKey: `school:${String(schoolIdObj)}:billing`,
        });
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        schoolId: id,
        tierId: String(tier._id),
        tierName: tier.name,
        status: updated.status,
        basePriceMinor: updated.basePriceMinor,
        manualPriceOverrideMinor: updated.manualPriceOverrideMinor ?? null,
        discountMode: updated.discountMode,
        discountValue: updated.discountValue ?? null,
        effectivePriceMinor: updated.effectivePriceMinor,
        note: updated.note || null,
        billingCadence: updated.billingCadence || null,
        lifecycleMode: updated.lifecycleMode || null,
        startsAt: updated.startsAt?.toISOString?.().slice(0, 10) || null,
        endsAt: updated.endsAt?.toISOString?.().slice(0, 10) || null,
        trialEndsAt: updated.trialEndsAt?.toISOString?.().slice(0, 10) || null,
        pilotEndsAt: updated.pilotEndsAt?.toISOString?.().slice(0, 10) || null,
        gracePeriodEndsAt:
          updated.gracePeriodEndsAt?.toISOString?.().slice(0, 10) || null,
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

    console.error("Failed to update school subscription from school route:", error);
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
