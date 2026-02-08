// src/app/api/parent/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Notification } from "@/models/Notification";

export async function PATCH(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid notification ID" },
        { status: 400 }
      );
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: context.userId,
        schoolId: context.schoolId,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    ).lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!notification) {
      return NextResponse.json(
        { success: false, error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: String(notification._id), isRead: true },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to mark notification as read:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update notification",
      },
      { status: 500 }
    );
  }
}
