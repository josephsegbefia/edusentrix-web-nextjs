import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import { School } from "@/models/School";
import { User } from "@/models/User";

export async function POST() {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const [subscription, school, actor] = await Promise.all([
      SchoolSubscription.findOne({ schoolId: schoolIdObj }),
      School.findById(schoolIdObj).select("name"),
      User.findById(userId).select("email").lean<{ email?: string } | null>(),
    ]);

    if (!subscription || !school) {
      return NextResponse.json(
        { success: false, error: "Subscription not found." },
        { status: 404 }
      );
    }

    subscription.status = "cancelled";
    subscription.updatedBy = userId;
    subscription.updatedByEmail = actor?.email || null;
    await subscription.save();

    await SubscriptionEvent.create({
      schoolId: schoolIdObj,
      subscriptionId: subscription._id,
      eventType: "subscription_cancelled",
      actorId: userId,
      actorEmail: actor?.email || null,
      summary: `${school.name || "School"} cancelled its subscription.`,
      metadata: { tierCode: subscription.tierCode || null },
    });

    return NextResponse.json({ success: true, data: { status: subscription.status } });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to cancel subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel subscription",
      },
      { status: 500 }
    );
  }
}
