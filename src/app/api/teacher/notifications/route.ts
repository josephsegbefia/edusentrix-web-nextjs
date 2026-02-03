import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Notification } from "@/models/Notification";

export async function GET(req: NextRequest) {
  try {
    const context = await requireTeacher({ mode: "api" });
    await connectToDatabase();

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const query: Record<string, unknown> = {
      userId: context.userId,
      schoolId: context.schoolId,
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    const [total, unreadCount] = await Promise.all([
      Notification.countDocuments(query),
      Notification.countDocuments({
        userId: context.userId,
        schoolId: context.schoolId,
        isRead: false,
      }),
    ]);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const hasMore = offset + limit < total;

    return NextResponse.json({
      success: true,
      data: {
        unreadCount,
        notifications: notifications.map((n) => ({
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
    console.error("Failed to fetch teacher notifications:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      },
      { status: 500 }
    );
  }
}
