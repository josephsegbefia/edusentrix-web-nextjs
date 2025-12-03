import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity, type ActivityType } from "@/models/Activity";
import mongoose from "mongoose";

type RecordActivityParams = {
  schoolId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  type: ActivityType;
  entityType?: string;
  entityId?: string | mongoose.Types.ObjectId;
  description: string;
  metadata?: Record<string, unknown>;
};

export async function recordActivity(params: RecordActivityParams): Promise<void> {
  try {
    await connectToDatabase();

    const schoolIdObj =
      typeof params.schoolId === "string"
        ? new mongoose.Types.ObjectId(params.schoolId)
        : params.schoolId;

    const userIdObj =
      typeof params.userId === "string"
        ? new mongoose.Types.ObjectId(params.userId)
        : params.userId;

    const entityIdObj =
      params.entityId
        ? typeof params.entityId === "string"
          ? new mongoose.Types.ObjectId(params.entityId)
          : params.entityId
        : undefined;

    await Activity.create({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: params.type,
      entityType: params.entityType,
      entityId: entityIdObj,
      description: params.description,
      metadata: params.metadata || {},
    });
  } catch (error) {
    // Don't fail the main operation if activity logging fails
    console.error("Failed to record activity:", error);
  }
}
