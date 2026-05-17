import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Notification } from "@/models/Notification";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const rawLimit = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 40;

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      userId: context.userId,
      entityType: "Communication",
    };

    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ title: regex }, { body: regex }];
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("title body type priority actionUrl entityId createdAt")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        notices: notifications.map((notification) => ({
          id: String(notification._id),
          title: notification.title,
          message: notification.body,
          status: "published",
          audience: "school",
          attachments: [],
          counts: {
            classGroups: 0,
            subjects: 0,
            students: 0,
          },
          actionUrl: notification.actionUrl || null,
          communicationId: notification.entityId ? String(notification.entityId) : null,
          priority: notification.priority,
          scheduledFor: null,
          publishedAt: notification.createdAt ? notification.createdAt.toISOString() : null,
          createdAt: notification.createdAt ? notification.createdAt.toISOString() : null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch student communication notices:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notices",
      },
      { status: 500 },
    );
  }
}
