import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import { PLAN_CODES } from "@/lib/subscriptions/plan-codes";

const CreatePlanSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  publicVisible: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  version: z.number().int().min(1).default(1),
  priceMinor: z.number().int().min(0),
  billingCadence: z.enum(["term", "annual", "monthly", "custom"]).default("term"),
  pricing: z
    .object({
      currency: z.string().default("GHS"),
      pricePerStudentPerTermMinor: z.number().int().min(0).nullable().optional(),
      minimumTermFeeMinor: z.number().int().min(0).nullable().optional(),
      annualDiscountPercent: z.number().min(0).max(100).nullable().optional(),
      onboardingFeeMinor: z.number().int().min(0).nullable().optional(),
    })
    .optional()
    .nullable(),
  features: z.array(z.string().trim()).default([]),
  limits: z.record(z.number().nullable()).optional().nullable(),
});

// GET /api/platform/subscription-plans
export async function GET(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") !== "false";

  const query = activeOnly
    ? { code: { $in: Object.values(PLAN_CODES) }, active: true }
    : { code: { $in: Object.values(PLAN_CODES) } };
  const plans = await SubscriptionTier.find(query).sort({ sortOrder: 1 }).lean();

  return NextResponse.json({ success: true, data: plans });
}

// POST /api/platform/subscription-plans
export async function POST(req: NextRequest) {
  const perm = await requirePlatformPermission("platform.subscriptions.manage");
  if (!perm.ok) return perm.res;

  const body = await req.json();
  const parsed = CreatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  if (!Object.values(PLAN_CODES).includes(parsed.data.code as any)) {
    return NextResponse.json(
      { success: false, error: "Only Pilot, Starter, Growth, and Enterprise plans are allowed." },
      { status: 422 }
    );
  }

  await connectToDatabase();

  const existing = await SubscriptionTier.findOne({ code: parsed.data.code });
  if (existing) {
    return NextResponse.json(
      { success: false, error: `A plan with code "${parsed.data.code}" already exists.` },
      { status: 409 }
    );
  }

  const plan = await SubscriptionTier.create({
    ...parsed.data,
    provisional: true,
  });

  return NextResponse.json({ success: true, data: plan }, { status: 201 });
}
