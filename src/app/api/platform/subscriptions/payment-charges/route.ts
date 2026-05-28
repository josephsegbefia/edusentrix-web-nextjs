/**
 * GET  /api/platform/subscriptions/payment-charges  — list policies
 * POST /api/platform/subscriptions/payment-charges  — create policy
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PaymentChargePolicy, PAYMENT_CATEGORIES } from "@/models/PaymentChargePolicy";

const CreatePolicySchema = z.object({
  scope: z.enum(["global", "school", "category", "school_category"]),
  schoolId: z.string().nullable().optional(),
  category: z.enum(PAYMENT_CATEGORIES as [string, ...string[]]).nullable().optional(),
  chargeType: z.enum(["percentage", "fixed", "hybrid"]),
  percentageBps: z.number().int().min(0).max(10000).nullable().optional(),
  fixedFeeMinor: z.number().int().min(0).nullable().optional(),
  minChargeMinor: z.number().int().min(0).nullable().optional(),
  maxChargeMinor: z.number().int().min(0).nullable().optional(),
  payerMode: z.enum(["payer_pays", "school_absorbs", "waived"]),
  active: z.boolean().default(true),
  description: z.string().trim().max(300).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? null;
  const schoolId = url.searchParams.get("schoolId") ?? null;
  const activeOnly = url.searchParams.get("activeOnly") !== "false";

  const filter: Record<string, unknown> = {};
  if (activeOnly) filter.active = true;
  if (scope) filter.scope = scope;
  if (schoolId) filter.schoolId = schoolId;

  const policies = await PaymentChargePolicy.find(filter)
    .sort({ scope: 1, category: 1, createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    data: policies.map((p) => ({
      ...p,
      _id: String(p._id),
      schoolId: p.schoolId ? String(p.schoolId) : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const body = await req.json();
  const parsed = CreatePolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const policy = await PaymentChargePolicy.create({
    ...parsed.data,
    currency: "GHS",
    createdByEmail: perm.actor.email ?? null,
  });

  return NextResponse.json(
    {
      success: true,
      data: { ...policy.toObject(), _id: String(policy._id) },
    },
    { status: 201 }
  );
}
