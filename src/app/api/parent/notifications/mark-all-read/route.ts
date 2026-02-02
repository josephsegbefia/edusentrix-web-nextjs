// src/app/api/parent/notifications/mark-all-read/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Notification } from "@/models/Notification";

export async function POST() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const result = await Notification.updateMany(
      {
        userId: context.userId,
        schoolId: context.schoolId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return NextResponse.json({
      success: true,
      data: { 
        modifiedCount: result.modifiedCount,
        message: `Marked ${result.modifiedCount} notification(s) as read`,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to mark all notifications as read:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update notifications",
      },
      { status: 500 }
    );
  }
}
