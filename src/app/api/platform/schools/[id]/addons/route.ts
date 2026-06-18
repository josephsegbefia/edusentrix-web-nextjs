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
import { markSchoolAddOnCredited } from "@/lib/subscriptions/credit-school-addon";

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

  const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
  const duplicate = await SubscriptionAddOn.findOne({
    schoolId: schoolObjectId,
    addonType: parsed.data.addonType,
    status: { $in: ["pending", "paid"] },
  })
    .select("_id status")
    .lean<{ _id: mongoose.Types.ObjectId; status: string } | null>();

  if (duplicate) {
    return NextResponse.json(
      {
        success: false,
        error: `This school already has a ${duplicate.status} ${parsed.data.addonType.replace(/_/g, " ")} add-on. Resolve or remove it before adding another.`,
      },
      { status: 409 },
    );
  }

  let addon;
  try {
    addon = await SubscriptionAddOn.create({
      schoolId: schoolObjectId,
      subscriptionId: sub?._id ?? null,
      addonType: parsed.data.addonType,
      quantity: parsed.data.quantity,
      priceMinor: parsed.data.priceMinor,
      status: "pending",
      note: parsed.data.note ?? null,
      invoiceReference: parsed.data.invoiceReference ?? null,
      createdByEmail: perm.actor.email ?? null,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json(
        { success: false, error: "This school already has an unresolved add-on of this type." },
        { status: 409 },
      );
    }
    throw error;
  }

  let finalAddon = addon;

  // Learn seats: grant capacity immediately. Price is per-seat billing reference; parents pay later.
  if (parsed.data.addonType === "learn_seats") {
    const credited = await markSchoolAddOnCredited({
      addonId: addon._id,
      schoolId: new mongoose.Types.ObjectId(schoolId),
      actorEmail: perm.actor.email ?? null,
    });
    if (!credited.ok) {
      return NextResponse.json({ success: false, error: credited.error }, { status: 500 });
    }
    finalAddon = credited.addon;
  }

  await recordSubscriptionEvent({
    schoolId: schoolObjectId,
    subscriptionId: sub?._id ?? null,
    eventType: "addon_purchased",
    actorEmail: perm.actor.email ?? null,
    summary:
      parsed.data.addonType === "learn_seats"
        ? `Learn seats granted: ${addon.quantity} seats at ${addon.priceMinor} minor units per seat (parent billing reference).`
        : `Add-on created: ${addon.addonType} × ${addon.quantity}. Status: pending. Created by platform admin.`,
    metadata: {
      addonId: String(addon._id),
      addonType: addon.addonType,
      quantity: addon.quantity,
      priceMinor: addon.priceMinor,
      priceUnit: parsed.data.addonType === "learn_seats" ? "per_seat" : "total",
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        ...finalAddon.toObject(),
        _id: String(finalAddon._id),
        schoolId: String(finalAddon.schoolId),
        subscriptionId: finalAddon.subscriptionId ? String(finalAddon.subscriptionId) : null,
      },
    },
    { status: 201 }
  );
}
