/**
 * PATCH /api/platform/schools/[id]/addons/[addonId]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionAddOn } from "@/models/SubscriptionAddOn";
import { markSchoolAddOnCredited } from "@/lib/subscriptions/credit-school-addon";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";

type Params = { params: Promise<{ id: string; addonId: string }> };

const PatchAddOnSchema = z.object({
  status: z.enum(["pending", "paid", "credited", "cancelled", "refunded"]),
  paymentReference: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

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

  if (parsed.data.status === "credited" && addon.status !== "credited") {
    const credited = await markSchoolAddOnCredited({
      addonId,
      schoolId: new mongoose.Types.ObjectId(schoolId),
      actorEmail: perm.actor.email ?? null,
    });
    if (!credited.ok) {
      return NextResponse.json({ success: false, error: credited.error }, { status: 409 });
    }

    if (parsed.data.paymentReference) credited.addon.paymentReference = parsed.data.paymentReference;
    if (parsed.data.note) credited.addon.note = parsed.data.note;
    if (parsed.data.paymentReference || parsed.data.note) await credited.addon.save();

    return NextResponse.json({
      success: true,
      data: {
        ...credited.addon.toObject(),
        _id: String(credited.addon._id),
        schoolId: String(credited.addon.schoolId),
        subscriptionId: credited.addon.subscriptionId ? String(credited.addon.subscriptionId) : null,
      },
    });
  }

  const update: Record<string, unknown> = {
    status: parsed.data.status,
  };

  if (parsed.data.paymentReference) update.paymentReference = parsed.data.paymentReference;
  if (parsed.data.note) update.note = parsed.data.note;

  if (parsed.data.status === "cancelled") {
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const { id: schoolId, addonId } = await params;
  if (
    !mongoose.Types.ObjectId.isValid(schoolId) ||
    !mongoose.Types.ObjectId.isValid(addonId)
  ) {
    return NextResponse.json({ success: false, error: "Invalid ID." }, { status: 400 });
  }

  await connectToDatabase();

  const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
  const addon = await SubscriptionAddOn.findOne({
    _id: addonId,
    schoolId: schoolObjectId,
  });

  if (!addon) {
    return NextResponse.json({ success: false, error: "Add-on not found." }, { status: 404 });
  }

  if (addon.status !== "pending") {
    return NextResponse.json(
      { success: false, error: "Only pending add-ons can be removed." },
      { status: 409 },
    );
  }

  await SubscriptionAddOn.deleteOne({
    _id: addon._id,
    schoolId: schoolObjectId,
    status: "pending",
  });

  await recordSubscriptionEvent({
    schoolId: schoolObjectId,
    subscriptionId: addon.subscriptionId ?? null,
    eventType: "addon_removed",
    actorEmail: perm.actor.email ?? null,
    summary: `Pending add-on removed: ${addon.addonType} × ${addon.quantity}.`,
    metadata: {
      addonId: String(addon._id),
      addonType: addon.addonType,
      quantity: addon.quantity,
      priceMinor: addon.priceMinor,
    },
  });

  return NextResponse.json({ success: true });
}
