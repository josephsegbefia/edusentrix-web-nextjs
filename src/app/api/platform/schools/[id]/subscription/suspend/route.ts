import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { updateSchoolSubscriptionStatus } from "@/lib/platform-billing/school-subscription-actions";
import { User } from "@/models/User";

export async function POST(
  _req: Request,
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

    const actor = await User.findById(gate.me._id).select("email").lean<{ email?: string } | null>();
    const result = await updateSchoolSubscriptionStatus({
      schoolId: new mongoose.Types.ObjectId(id),
      actorId: gate.me._id as mongoose.Types.ObjectId,
      actorEmail: actor?.email || null,
      status: "suspended",
      summary: "School subscription suspended.",
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Subscription not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { schoolId: id, status: result.status } });
  } catch (error) {
    console.error("Failed to suspend school subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to suspend school subscription",
      },
      { status: 500 }
    );
  }
}
