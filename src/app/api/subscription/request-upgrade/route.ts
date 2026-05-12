import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { School } from "@/models/School";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { User } from "@/models/User";

const RequestUpgradeSchema = z.object({
  requestedPlanCode: z.string().trim().max(80).optional().nullable(),
  requestedCadence: z
    .enum(["term", "annual", "monthly", "custom"])
    .optional()
    .nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    const body = RequestUpgradeSchema.parse(await req.json().catch(() => ({})));
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const [school, subscription, actor] = await Promise.all([
      School.findById(schoolIdObj).select("name"),
      SchoolSubscription.findOne({ schoolId: schoolIdObj }),
      User.findById(userId).select("email").lean<{ email?: string } | null>(),
    ]);

    if (!school || !subscription) {
      return NextResponse.json(
        { success: false, error: "Subscription not found." },
        { status: 404 }
      );
    }

    await SubscriptionEvent.create({
      schoolId: schoolIdObj,
      subscriptionId: subscription._id,
      eventType: "subscription_updated",
      actorId: userId,
      actorEmail: actor?.email || null,
      summary: `${school.name || "School"} requested a subscription review.`,
      metadata: {
        requestType: "plan_review",
        requestedPlanCode: body.requestedPlanCode || null,
        requestedCadence: body.requestedCadence || null,
        message: body.message || null,
        currentTierCode: subscription.tierCode || null,
        currentStatus: subscription.status || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        requested: true,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid plan review request." },
        { status: 400 }
      );
    }

    console.error("Failed to create subscription review request:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create subscription review request",
      },
      { status: 500 }
    );
  }
}
