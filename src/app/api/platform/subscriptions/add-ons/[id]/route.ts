/**
 * PATCH  /api/platform/subscriptions/add-ons/[id]
 * DELETE /api/platform/subscriptions/add-ons/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AddOnPackage } from "@/models/AddOnPackage";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  priceMinor: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  availableToPlans: z.array(z.string()).optional(),
  expiresWithBillingPeriod: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  displayQuantity: z.number().nullable().optional(),
  displayUnit: z.string().trim().max(30).nullable().optional(),
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
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  await connectToDatabase();

  const pkg = await AddOnPackage.findByIdAndUpdate(id, { $set: parsed.data }, { new: true });
  if (!pkg) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

  return NextResponse.json({ success: true, data: { ...pkg.toObject(), _id: String(pkg._id) } });
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
  await AddOnPackage.findByIdAndUpdate(id, { $set: { active: false } });

  return NextResponse.json({ success: true });
}
