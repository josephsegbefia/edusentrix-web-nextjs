// src/app/api/parent/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";

type UserLookupRow = {
  _id: mongoose.Types.ObjectId;
};

type WardSummary = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
};

type NotificationRow = {
  _id: mongoose.Types.ObjectId;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  wardId?: WardSummary | mongoose.Types.ObjectId | null;
  actionUrl?: string;
  priority: string;
};

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    // Get the user document to find the internal user ID
    const user = await User.findOne({ 
      _id: context.userId 
    })
      .select("_id")
      .lean<UserLookupRow | null>();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Build query
    const query: mongoose.FilterQuery<typeof Notification> = {
      userId: user._id,
      schoolId: context.schoolId,
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    // Get total count and unread count
    const [total, unreadCount] = await Promise.all([
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: user._id, schoolId: context.schoolId, isRead: false }),
    ]);

    // Fetch notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("wardId", "firstName lastName")
      .lean<NotificationRow[]>();

    const hasMore = offset + limit < total;

    return NextResponse.json({
      success: true,
      data: {
        unreadCount,
        notifications: notifications.map((n) => ({
          ...(() => {
            const ward =
              n.wardId && typeof n.wardId === "object" && "firstName" in n.wardId
                ? (n.wardId as WardSummary)
                : null;
            return {
              wardId: ward ? String(ward._id) : undefined,
              wardName: ward
                ? `${ward.firstName || ""} ${ward.lastName || ""}`.trim() || undefined
                : undefined,
            };
          })(),
          id: String(n._id),
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
          actionUrl: n.actionUrl,
          priority: n.priority,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      },
      { status: 500 }
    );
  }
}
