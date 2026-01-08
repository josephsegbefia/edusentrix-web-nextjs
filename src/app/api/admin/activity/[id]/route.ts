import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity } from "@/models/Activity";
import mongoose from "mongoose";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    if (!schoolId) {
      return Response.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }
    await connectToDatabase();

    const { id } = await ctx.params;
    const activityId = toObjectIdOrNull(id);
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    if (!activityId) {
      return Response.json(
        { success: false, error: "Invalid activity ID" },
        { status: 400 }
      );
    }

    // Find the activity and verify it belongs to the school
    const activity = await Activity.findOne({
      _id: activityId,
      schoolId: schoolIdObj,
    }).lean();

    if (!activity) {
      return Response.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      );
    }

    // Check if activity is older than a month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const activityDate = new Date(activity.createdAt);

    if (activityDate >= oneMonthAgo) {
      return Response.json(
        {
          success: false,
          error: "Cannot delete activities less than a month old",
        },
        { status: 400 }
      );
    }

    // Delete the activity
    await Activity.deleteOne({ _id: activityId, schoolId: schoolIdObj });

    return Response.json({ success: true });
  } catch (e: unknown) {
    console.error("Failed to delete activity:", e);
    const message =
      e instanceof Error ? e.message : "Failed to delete activity";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}
