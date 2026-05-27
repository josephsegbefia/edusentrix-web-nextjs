/**
 * PATCH /api/platform/schools/[id]/addons/[addonId]
 *
 * Update add-on status. Primarily used for:
 *   - paid → confirmed payment
 *   - paid → credited → applies to UsageBalance
 *   - any → cancelled
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionAddOn, type AddOnType } from "@/models/SubscriptionAddOn";
import { UsageBalance, type UsageBalanceType } from "@/models/UsageBalance";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";

type Params = { params: Promise<{ id: string; addonId: string }> };

const ADDON_TO_USAGE_TYPE: Partial<Record<AddOnType, UsageBalanceType>> = {
  leo_credits: "leo_credits",
  learn_seats: "learn_seats",
  meeting_minutes: "meeting_participant_minutes",
  storage_gb: "storage_bytes",
  sms_credits: "sms_credits",
  whatsapp_credits: "whatsapp_credits",
};

const PatchAddOnSchema = z.object({
  status: z.enum(["pending", "paid", "credited", "cancelled", "refunded"]),
  paymentReference: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const { id: schoolId, addonId } = await params;
  if (
    !mongoose.Types.ObjectId.isValid(schoolId) ||
    !mongoose.Types.ObjectId.isValid(addonId)
  ) {
    return NextResponse.json({ success: false, error: "Invalid ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchAddOnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const addon = await SubscriptionAddOn.findOne({
    _id: addonId,
    schoolId: new mongoose.Types.ObjectId(schoolId),
  });

  if (!addon) {
    return NextResponse.json({ success: false, error: "Add-on not found." }, { status: 404 });
  }

  if (addon.status === "cancelled" || addon.status === "refunded") {
    return NextResponse.json(
      { success: false, error: "Cannot update a cancelled or refunded add-on." },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {
    status: parsed.data.status,
  };

  if (parsed.data.paymentReference) update.paymentReference = parsed.data.paymentReference;
  if (parsed.data.note) update.note = parsed.data.note;

  // When crediting — apply to UsageBalance
  if (parsed.data.status === "credited" && addon.status !== "credited") {
    update.creditedAt = new Date();

    const usageType = ADDON_TO_USAGE_TYPE[addon.addonType];
    if (usageType) {
      const sub = await SchoolSubscription.findOne({ schoolId: new mongoose.Types.ObjectId(schoolId) })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId } | null>();

      if (sub) {
        // Convert storage_gb to bytes
        const quantity =
          addon.addonType === "storage_gb"
            ? addon.quantity * 1024 * 1024 * 1024
            : addon.quantity;

        await UsageBalance.findOneAndUpdate(
          {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            subscriptionId: sub._id,
            balanceType: usageType,
          },
          { $inc: { purchasedQuantity: quantity } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    await recordSubscriptionEvent({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      subscriptionId: addon.subscriptionId ?? null,
      eventType: "addon_credited",
      actorEmail: auth.email ?? null,
      summary: `Add-on credited: ${addon.addonType} × ${addon.quantity}. Applied to usage balance.`,
      metadata: {
        addonId: String(addon._id),
        addonType: addon.addonType,
        quantity: addon.quantity,
        usageType,
      },
    });
  } else if (parsed.data.status === "cancelled") {
    update.cancelledAt = new Date();
  }

  const updated = await SubscriptionAddOn.findByIdAndUpdate(
    addonId,
    { $set: update },
    { new: true }
  );

  return NextResponse.json({
    success: true,
    data: {
      ...updated!.toObject(),
      _id: String(updated!._id),
      schoolId: String(updated!.schoolId),
      subscriptionId: updated!.subscriptionId ? String(updated!.subscriptionId) : null,
    },
  });
}
