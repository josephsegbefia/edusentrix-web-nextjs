import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionTier } from "@/models/SubscriptionTier";

const UpdateSubscriptionTierSchema = z.object({
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

async function resolveTierId(
  context: { params: Promise<{ tierId?: string; id?: string }> }
) {
  const params = await context.params;
  return params.tierId || params.id || "";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ tierId?: string; id?: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const tierId = await resolveTierId(context);
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier id." },
        { status: 400 }
      );
    }

    const tier = await SubscriptionTier.findById(new mongoose.Types.ObjectId(tierId)).lean();

    if (!tier) {
      return NextResponse.json(
        { success: false, error: "Subscription tier not found." },
        { status: 404 }
      );
    }

    const assignedSchoolCount = await SchoolSubscription.countDocuments({
      tierId: tier._id,
    });

    return NextResponse.json({
      success: true,
      data: {
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
        assignedSchoolCount,
        updatedAt: tier.updatedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    console.error("Failed to load subscription tier:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load subscription tier",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tierId?: string; id?: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const tierId = await resolveTierId(context);
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier id." },
        { status: 400 }
      );
    }

    const body = UpdateSubscriptionTierSchema.parse(await req.json());
    const tierIdObj = new mongoose.Types.ObjectId(tierId);

    if (!body.active) {
      const assignedCount = await SchoolSubscription.countDocuments({ tierId: tierIdObj });
      if (assignedCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This tier is currently assigned to one or more schools. Reassign them before deactivating the tier.",
          },
          { status: 400 }
        );
      }
    }

    const updated = await SubscriptionTier.findByIdAndUpdate(
      tierIdObj,
      {
        $set: {
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
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Subscription tier not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier payload." },
        { status: 400 }
      );
    }

    console.error("Failed to update subscription tier:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update subscription tier",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ tierId?: string; id?: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const tierId = await resolveTierId(context);
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription tier id." },
        { status: 400 }
      );
    }

    const tierIdObj = new mongoose.Types.ObjectId(tierId);
    const assignedCount = await SchoolSubscription.countDocuments({ tierId: tierIdObj });

    if (assignedCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This tier is currently assigned to one or more schools. Reassign them before deleting it.",
        },
        { status: 400 }
      );
    }

    const deleted = await SubscriptionTier.findByIdAndDelete(tierIdObj).lean();
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Subscription tier not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(deleted._id),
      },
    });
  } catch (error) {
    console.error("Failed to delete subscription tier:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete subscription tier",
      },
      { status: 500 }
    );
  }
}
