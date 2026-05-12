import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ensureDefaultSubscriptionTiers } from "@/lib/platform-billing/subscription-tiers";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";

const CreateSubscriptionTierSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(
      /^[a-z0-9_]+$/,
      "Tier code must use lowercase letters, numbers, and underscores only."
    ),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable().optional().default(null),
  priceMinor: z.number().int().min(0),
  billingCadence: z
    .enum(["term", "annual", "monthly", "custom"])
    .optional()
    .default("term"),
  studentLimit: z.number().int().positive().nullable().optional().default(null),
  features: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
  publicVisible: z.boolean().default(false),
  version: z.number().int().min(1).default(1),
  provisional: z.boolean().default(true),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

type SubscriptionTierRow = {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  billingCadence: "term" | "annual" | "monthly" | "custom";
  studentLimit?: number | null;
  features?: string[];
  publicVisible?: boolean;
  version?: number;
  provisional: boolean;
  active: boolean;
  sortOrder: number;
  updatedAt?: Date;
};

type TierCountRow = {
  _id: mongoose.Types.ObjectId;
  count: number;
};

function normalizeFeatures(features: string[]) {
  return Array.from(
    new Set(
      features
        .map((feature) => feature.trim())
        .filter(Boolean)
        .slice(0, 24)
    )
  );
}

async function loadTierData() {
  await ensureDefaultSubscriptionTiers();

  const [tiers, counts] = await Promise.all([
    SubscriptionTier.find({})
      .sort({ sortOrder: 1, name: 1 })
      .lean<SubscriptionTierRow[]>(),
    SchoolSubscription.aggregate<TierCountRow>([
      { $match: { tierId: { $ne: null } } },
      { $group: { _id: "$tierId", count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(counts.map((row) => [String(row._id), row.count]));

  return {
    tiers: tiers.map((tier) => ({
      id: String(tier._id),
      code: tier.code,
      name: tier.name,
      description: tier.description || null,
      priceMinor: tier.priceMinor,
      billingCadence: tier.billingCadence,
      studentLimit: tier.studentLimit ?? null,
      features: Array.isArray(tier.features) ? tier.features : [],
      publicVisible: Boolean(tier.publicVisible),
      version: tier.version ?? 1,
      provisional: Boolean(tier.provisional),
      active: Boolean(tier.active),
      sortOrder: tier.sortOrder,
      assignedSchoolCount: countMap.get(String(tier._id)) || 0,
      updatedAt: tier.updatedAt?.toISOString?.() || null,
    })),
  };
}

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const data = await loadTierData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load subscription tiers:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load subscription tiers",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const body = CreateSubscriptionTierSchema.parse(await req.json());
    const existing = await SubscriptionTier.findOne({ code: body.code })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A subscription tier with that code already exists." },
        { status: 409 }
      );
    }

    const created = await SubscriptionTier.create({
      code: body.code,
      name: body.name,
      description: body.description,
      priceMinor: body.priceMinor,
      billingCadence: body.billingCadence,
      studentLimit: body.studentLimit,
      features: normalizeFeatures(body.features),
      publicVisible: body.publicVisible,
      version: body.version,
      provisional: body.provisional,
      active: body.active,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(created._id),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier payload." },
        { status: 400 }
      );
    }

    console.error("Failed to create subscription tier:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create subscription tier",
      },
      { status: 500 }
    );
  }
}
