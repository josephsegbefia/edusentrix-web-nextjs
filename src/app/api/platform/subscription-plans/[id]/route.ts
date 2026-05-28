import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";

const UpdatePlanSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  publicVisible: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  priceMinor: z.number().int().min(0).optional(),
  billingCadence: z.enum(["term", "annual", "monthly", "custom"]).optional(),
  pricing: z
    .object({
      currency: z.string().optional(),
      pricePerStudentPerTermMinor: z.number().int().min(0).nullable().optional(),
      minimumTermFeeMinor: z.number().int().min(0).nullable().optional(),
      annualDiscountPercent: z.number().min(0).max(100).nullable().optional(),
      onboardingFeeMinor: z.number().int().min(0).nullable().optional(),
    })
    .nullable()
    .optional(),
  features: z.array(z.string().trim()).optional(),
  limits: z.record(z.number().nullable()).nullable().optional(),
});

// GET /api/platform/subscription-plans/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid plan ID." }, { status: 400 });
  }

  await connectToDatabase();
  const plan = await SubscriptionTier.findOne({
    _id: id,
    code: { $in: Object.values(PLAN_CODES) },
  }).lean();

  if (!plan) {
    return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: plan });
}

// PATCH /api/platform/subscription-plans/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Invalid plan ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = UpdatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const updated = await SubscriptionTier.findOneAndUpdate(
    { _id: id, code: { $in: Object.values(PLAN_CODES) } },
    { $set: parsed.data },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}
