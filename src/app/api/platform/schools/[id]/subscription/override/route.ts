import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { updateSchoolSubscriptionCommercialTerms } from "@/lib/platform-billing/school-subscription-actions";
import { User } from "@/models/User";

const OverrideSchema = z.object({
  manualPriceOverrideMinor: z.number().int().min(0).nullable(),
  note: z.string().trim().max(240).nullable().optional().default(null),
});

async function getActorEmail(userId: mongoose.Types.ObjectId) {
  const actor = await User.findById(userId).select("email").lean<{ email?: string } | null>();
  return actor?.email || null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const body = OverrideSchema.parse(await req.json());
    const schoolId = new mongoose.Types.ObjectId(id);
    const actorEmail = await getActorEmail(gate.me._id as mongoose.Types.ObjectId);
    const result = await updateSchoolSubscriptionCommercialTerms({
      schoolId,
      actorId: gate.me._id as mongoose.Types.ObjectId,
      actorEmail,
      manualPriceOverrideMinor: body.manualPriceOverrideMinor,
      note: body.note,
      summary: "Manual subscription price override updated.",
      metadata: {
        action: "override_set",
      },
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Subscription not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        manualPriceOverrideMinor: result.subscription.manualPriceOverrideMinor ?? null,
        effectivePriceMinor: result.subscription.effectivePriceMinor,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid override payload." },
        { status: 400 }
      );
    }

    console.error("Failed to set school subscription override:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to set school subscription override",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const schoolId = new mongoose.Types.ObjectId(id);
    const actorEmail = await getActorEmail(gate.me._id as mongoose.Types.ObjectId);
    const result = await updateSchoolSubscriptionCommercialTerms({
      schoolId,
      actorId: gate.me._id as mongoose.Types.ObjectId,
      actorEmail,
      manualPriceOverrideMinor: null,
      summary: "Manual subscription price override removed.",
      metadata: {
        action: "override_removed",
      },
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Subscription not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        manualPriceOverrideMinor: null,
        effectivePriceMinor: result.subscription.effectivePriceMinor,
      },
    });
  } catch (error) {
    console.error("Failed to remove school subscription override:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove school subscription override",
      },
      { status: 500 }
    );
  }
}
