/**
 * PATCH  /api/platform/subscriptions/payment-charges/[id]
 * DELETE /api/platform/subscriptions/payment-charges/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PaymentChargePolicy, PAYMENT_CATEGORIES } from "@/models/PaymentChargePolicy";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  chargeType: z.enum(["percentage", "fixed", "hybrid"]).optional(),
  percentageBps: z.number().int().min(0).max(10000).nullable().optional(),
  fixedFeeMinor: z.number().int().min(0).nullable().optional(),
  minChargeMinor: z.number().int().min(0).nullable().optional(),
  maxChargeMinor: z.number().int().min(0).nullable().optional(),
  payerMode: z.enum(["payer_pays", "school_absorbs", "waived"]).optional(),
  active: z.boolean().optional(),
  description: z.string().trim().max(300).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const policy = await PaymentChargePolicy.findByIdAndUpdate(
    id,
    { $set: parsed.data },
    { new: true }
  );

  if (!policy) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: { ...policy.toObject(), _id: String(policy._id) },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.subscriptions.manage");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid ID." }, { status: 400 });
  }

  await connectToDatabase();

  await PaymentChargePolicy.findByIdAndUpdate(id, { $set: { active: false } });

  return NextResponse.json({ success: true });
}
