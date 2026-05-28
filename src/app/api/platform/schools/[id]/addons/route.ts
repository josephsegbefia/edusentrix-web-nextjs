/**
 * GET  /api/platform/schools/[id]/addons  — list add-ons for a school
 * POST /api/platform/schools/[id]/addons  — create an add-on purchase record
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionAddOn, ADDON_TYPES } from "@/models/SubscriptionAddOn";
import { recordSubscriptionEvent } from "@/lib/subscriptions/record-event";

type Params = { params: Promise<{ id: string }> };

const CreateAddOnSchema = z.object({
  addonType: z.enum(ADDON_TYPES as [string, ...string[]]),
  quantity: z.number().int().min(1),
  priceMinor: z.number().int().min(0).default(0),
  note: z.string().trim().max(500).nullable().optional(),
  invoiceReference: z.string().trim().max(100).nullable().optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  await connectToDatabase();

  const addons = await SubscriptionAddOn.find({ schoolId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({
    success: true,
    data: addons.map((a) => ({
      ...a,
      _id: String(a._id),
      schoolId: String(a.schoolId),
      subscriptionId: a.subscriptionId ? String(a.subscriptionId) : null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = CreateAddOnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const [school, sub] = await Promise.all([
    School.findById(schoolId).select("name").lean<{ _id: mongoose.Types.ObjectId; name?: string } | null>(),
    SchoolSubscription.findOne({ schoolId }).select("_id").lean<{ _id: mongoose.Types.ObjectId } | null>(),
  ]);

  if (!school) {
    return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
  }

  const addon = await SubscriptionAddOn.create({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    subscriptionId: sub?._id ?? null,
    addonType: parsed.data.addonType,
    quantity: parsed.data.quantity,
    priceMinor: parsed.data.priceMinor,
    status: "pending",
    note: parsed.data.note ?? null,
    invoiceReference: parsed.data.invoiceReference ?? null,
    createdByEmail: perm.actor.email ?? null,
  });

  await recordSubscriptionEvent({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    subscriptionId: sub?._id ?? null,
    eventType: "addon_purchased",
    actorEmail: perm.actor.email ?? null,
    summary: `Add-on created: ${addon.addonType} × ${addon.quantity}. Status: pending. Created by platform admin.`,
    metadata: {
      addonId: String(addon._id),
      addonType: addon.addonType,
      quantity: addon.quantity,
      priceMinor: addon.priceMinor,
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        ...addon.toObject(),
        _id: String(addon._id),
        schoolId: String(addon.schoolId),
        subscriptionId: addon.subscriptionId ? String(addon.subscriptionId) : null,
      },
    },
    { status: 201 }
  );
}
