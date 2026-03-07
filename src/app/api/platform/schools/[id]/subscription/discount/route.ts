import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { updateSchoolSubscriptionCommercialTerms } from "@/lib/platform-billing/school-subscription-actions";
import { User } from "@/models/User";

const DiscountSchema = z
  .object({
    discountMode: z.enum(["percent", "fixed"]),
    discountValue: z.number().min(0),
    note: z.string().trim().max(240).nullable().optional().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.discountMode === "percent" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discount cannot exceed 100.",
      });
    }
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

    const body = DiscountSchema.parse(await req.json());
    const schoolId = new mongoose.Types.ObjectId(id);
    const actorEmail = await getActorEmail(gate.me._id as mongoose.Types.ObjectId);
    const result = await updateSchoolSubscriptionCommercialTerms({
      schoolId,
      actorId: gate.me._id as mongoose.Types.ObjectId,
      actorEmail,
      discountMode: body.discountMode,
      discountValue: body.discountValue,
      note: body.note,
      summary: "School subscription discount updated.",
      metadata: {
        action: "discount_set",
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
        discountMode: result.subscription.discountMode,
        discountValue: result.subscription.discountValue ?? null,
        effectivePriceMinor: result.subscription.effectivePriceMinor,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid discount payload." },
        { status: 400 }
      );
    }

    console.error("Failed to set school subscription discount:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to set school subscription discount",
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
      discountMode: "none",
      discountValue: null,
      summary: "School subscription discount removed.",
      metadata: {
        action: "discount_removed",
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
        discountMode: result.subscription.discountMode,
        discountValue: result.subscription.discountValue ?? null,
        effectivePriceMinor: result.subscription.effectivePriceMinor,
      },
    });
  } catch (error) {
    console.error("Failed to remove school subscription discount:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove school subscription discount",
      },
      { status: 500 }
    );
  }
}
